import {
  ChangePlan,
  reportOf,
  type ApplyReport,
  type ConflictPolicy,
  type DecidedChange,
  type PlannedChange,
} from '../domain/ChangePlan.js';
import { CraftTypeError, MissingModuleDependenciesError, NeedleError, UnknownModuleError } from '../domain/errors.js';
import { PACKAGE_JSON_PATH, PackageJsonDocument } from '../domain/PackageJsonDocument.js';
import { insertAtNeedle, needleToken, type FileEdit } from '../domain/needles.js';
import type { KnownProperties, ModuleProperties, PropertyValue, RawProperties } from '../domain/ModuleProperties.js';
import type { ModuleResource, ModuleSlug } from '../domain/ModuleResource.js';
import type { CraftModule } from '../domain/CraftModule.js';
import { normalizeDestinations } from '../domain/destinations.js';
import type {
  AppliedModule,
  ModulesHistory,
  ModuleResourcesReader,
  PathNormalizer,
  ProjectFiles,
  TemplateRenderer,
  VersionComparator,
} from '../domain/ports.js';

export interface ModulesApplicationServiceDependencies {
  readonly resources: readonly ModuleResource[];
  readonly files: ProjectFiles;
  readonly resourcesReader: ModuleResourcesReader;
  readonly renderer: TemplateRenderer;
  readonly history: ModulesHistory;
  readonly versions: VersionComparator;
  readonly paths: PathNormalizer;
  readonly clock: () => Date;
}

export interface ApplyOptions {
  /** `fail` (default) refuses the module if there is a conflict, `overwrite` replaces the existing item, `skip` keeps it. */
  readonly onConflict?: ConflictPolicy;
  /** Computes and returns the changes without writing anything, neither in the project nor in the history. */
  readonly dryRun?: boolean;
}

export interface ApplyResult {
  readonly slug: ModuleSlug;
  readonly dryRun: boolean;
  readonly changes: readonly DecidedChange[];
  readonly report: ApplyReport;
  /** Things the user should know about although the module applies, for example insertions a replacement loses. */
  readonly warnings: readonly string[];
}

/** Orchestration: no business rule here, only the chaining of ports. */
export class ModulesApplicationService {
  constructor(private readonly dependencies: ModulesApplicationServiceDependencies) {}

  list(): readonly ModuleResource[] {
    return this.dependencies.resources;
  }

  find(slug: ModuleSlug): ModuleResource {
    const resource = this.dependencies.resources.find((candidate) => candidate.slug === slug);
    if (resource === undefined) {
      throw new UnknownModuleError(slug);
    }
    return resource;
  }

  buildModule(
    slug: ModuleSlug,
    raw: RawProperties,
    known: KnownProperties = {},
  ): { resource: ModuleResource; properties: ModuleProperties; module: CraftModule } {
    const resource = this.find(slug);
    const properties = resource.propertiesDefinition.resolve(raw, known);
    return { resource, properties, module: resource.factory(properties) };
  }

  apply(slug: ModuleSlug, raw: RawProperties, { onConflict = 'fail', dryRun = false }: ApplyOptions = {}): ApplyResult {
    const built = this.buildModule(slug, raw, this.knownProperties(raw.projectFolder));
    const { resource, properties } = built;
    const module = normalizeDestinations(built.module, this.dependencies.paths);

    this.checkDependencies(resource, properties);
    const plan = this.plan(module);

    if (dryRun) {
      const changes = plan.decide(onConflict);
      return {
        slug,
        dryRun,
        changes,
        report: reportOf(changes),
        warnings: this.lostInsertions(slug, properties, changes),
      };
    }

    const changes = plan.resolve(onConflict);
    this.write(module, changes);

    const portable = resource.propertiesDefinition.portable(properties);
    if (!this.alreadyRecorded(slug, portable, properties.projectFolder, changes)) {
      this.dependencies.history.record(properties.projectFolder, {
        slug,
        properties: portable,
        appliedAt: this.dependencies.clock().toISOString(),
      });
    }
    return {
      slug,
      dryRun,
      changes,
      report: reportOf(changes),
      warnings: this.lostInsertions(slug, properties, changes),
    };
  }

  /**
   * Applies a module without going through the catalog or the history (used by module tests).
   * Nothing is written if an existing file or package.json entry would be overwritten by different content,
   * unless the policy allows it. Applying the same module again changes nothing.
   */
  applyModule(declared: CraftModule, { onConflict = 'fail' }: Pick<ApplyOptions, 'onConflict'> = {}): ApplyReport {
    const module = normalizeDestinations(declared, this.dependencies.paths);
    const changes = this.plan(module).resolve(onConflict);
    this.write(module, changes);
    return reportOf(changes);
  }

  /** What the module would change in the project, based on the current state of the files. */
  private plan(module: CraftModule): ChangePlan {
    const { files, resourcesReader, renderer } = this.dependencies;
    const { projectFolder, packageJson } = module;

    const fileChanges = module.files.map((file) => {
      const content = resourcesReader.read(file.module, file.path);
      const next = file.rendered ? renderer.render(content, module.context) : content;
      return {
        kind: 'file' as const,
        target: file.destination,
        current: files.read(projectFolder, file.destination),
        next,
      };
    });

    const editChanges = this.planEdits(module);

    const wanted = PackageJsonDocument.wantedBy(packageJson);
    if (wanted.length === 0) {
      return new ChangePlan([...fileChanges, ...editChanges], this.dependencies.versions);
    }

    const current = PackageJsonDocument.parse(files.read(projectFolder, PACKAGE_JSON_PATH));
    const packageJsonChanges = wanted.map(({ kind, target, value }) => ({
      kind,
      target,
      current: current.entry(kind, target),
      next: value,
    }));
    return new ChangePlan([...fileChanges, ...editChanges, ...packageJsonChanges], this.dependencies.versions);
  }

  /** One change per modified file: the insertions in the same file are chained in the order the module declares them. */
  private planEdits({ projectFolder, edits }: CraftModule): PlannedChange[] {
    // A group is created with its first edit: it is never empty, which the tuple type says.
    const byPath = new Map<string, [FileEdit, ...FileEdit[]]>();
    for (const edit of edits) {
      const group = byPath.get(edit.path);
      if (group === undefined) {
        byPath.set(edit.path, [edit]);
      } else {
        group.push(edit);
      }
    }

    return [...byPath].map(([path, fileEdits]) => {
      const current = this.dependencies.files.read(projectFolder, path);
      if (current === undefined) {
        throw new NeedleError(
          path,
          needleToken(fileEdits[0].needle),
          'file not found: apply the module that creates it first',
        );
      }
      return { kind: 'edit' as const, target: path, current, next: fileEdits.reduce(insertAtNeedle, current) };
    });
  }

  /** Writes only what is to be created, modified or replaced, so that up-to-date files are left untouched. */
  private write(module: CraftModule, changes: readonly DecidedChange[]): void {
    const { files } = this.dependencies;
    const toWrite = changes.filter(
      ({ decision }) => decision === 'create' || decision === 'edit' || decision === 'overwrite',
    );

    for (const { kind, target, next } of toWrite) {
      if (kind === 'file' || kind === 'edit') {
        files.write(module.projectFolder, target, next);
      }
    }

    const entries = toWrite.flatMap(({ kind, target, next }) =>
      kind === 'file' || kind === 'edit' ? [] : [{ kind, target, value: next }],
    );
    if (entries.length === 0) {
      return;
    }

    const current = PackageJsonDocument.parse(files.read(module.projectFolder, PACKAGE_JSON_PATH));
    files.write(module.projectFolder, PACKAGE_JSON_PATH, current.with(entries).serialize());
  }

  /**
   * Replacing a file that another applied module completed at a needle (`config` in the `main.ts` of `fastify-server`)
   * loses that module's insertions, and the history still lists it. Only a warning: the user asked for the replacement.
   */
  private lostInsertions(slug: ModuleSlug, properties: ModuleProperties, changes: readonly DecidedChange[]): string[] {
    const replaced = changes.filter(({ kind, decision }) => kind === 'file' && decision === 'overwrite');
    if (replaced.length === 0) {
      return [];
    }

    const { history, paths } = this.dependencies;
    const editors = history
      .list(properties.projectFolder)
      .filter((applied) => applied.slug !== slug)
      .flatMap((applied) => {
        try {
          const other = this.buildModule(applied.slug, {
            ...applied.properties,
            projectFolder: properties.projectFolder,
          });
          return [
            { slug: applied.slug, edited: normalizeDestinations(other.module, paths).edits.map(({ path }) => path) },
          ];
        } catch (error) {
          // A history entry that can no longer be rebuilt (module removed, property changed) cannot be checked.
          if (error instanceof CraftTypeError) {
            return [];
          }
          throw error;
        }
      });

    return replaced.flatMap(({ target }) => {
      const lost = editors.filter(({ edited }) => edited.includes(target)).map((editor) => editor.slug);
      return lost.length === 0
        ? []
        : [
            `${target} is replaced, and ${lost.join(', ')} had inserted code in it: apply ${lost.join(', ')} again to restore it`,
          ];
    });
  }

  /**
   * Applying a module again with the same properties and nothing to change leaves the history as it is: recording it
   * would only move the entry to the end and give it a new date, which is noise in version control.
   */
  private alreadyRecorded(
    slug: ModuleSlug,
    properties: KnownProperties,
    projectFolder: string,
    changes: readonly DecidedChange[],
  ): boolean {
    if (!changes.every(({ decision }) => decision === 'unchanged' || decision === 'keep')) {
      return false;
    }
    const recorded = this.dependencies.history.list(projectFolder).find((applied) => applied.slug === slug);
    return recorded !== undefined && sameProperties(recorded.properties, properties);
  }

  /** Properties already set by the applied modules; the most recent one wins. */
  private knownProperties(projectFolder: PropertyValue | undefined): KnownProperties {
    const folder = String(projectFolder ?? '');
    if (folder.trim() === '') {
      return {};
    }
    return this.dependencies.history
      .list(folder)
      .reduce<KnownProperties>((known, { properties }) => ({ ...known, ...properties }), {});
  }

  private checkDependencies(resource: ModuleResource, properties: ModuleProperties): void {
    const applied = new Set(this.dependencies.history.list(properties.projectFolder).map(({ slug }) => slug));
    const missing = resource.dependsOn.filter((slug) => !applied.has(slug));

    if (missing.length > 0) {
      throw new MissingModuleDependenciesError(resource.slug, missing);
    }
  }
}

const sameProperties = (left: KnownProperties, right: KnownProperties): boolean => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
};
