import {
  ChangePlan,
  reportOf,
  type ApplyReport,
  type ConflictPolicy,
  type DecidedChange,
  type PlannedChange,
} from '../domain/ChangePlan.js';
import {
  CraftTypeError,
  InvalidPropertyError,
  MissingModuleDependenciesError,
  NeedleError,
  UnknownModuleError,
} from '../domain/errors.js';
import { PACKAGE_JSON_PATH, PackageJsonDocument } from '../domain/PackageJsonDocument.js';
import { insertAtNeedle, needleToken, type FileEdit } from '../domain/needles.js';
import type { KnownProperties, ModuleProperties, PropertyValue, RawProperties } from '../domain/ModuleProperties.js';
import type { ModuleResource, ModuleSlug } from '../domain/ModuleResource.js';
import type { CraftModule } from '../domain/CraftModule.js';
import { normalizeDestinations } from '../domain/destinations.js';
import { frozenCopy } from '../domain/frozen.js';
import type {
  AppliedModule,
  ModulesHistory,
  ModuleResourcesReader,
  PathNormalizer,
  ProjectFiles,
  ProjectSimulator,
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
  readonly simulator: ProjectSimulator;
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

/** What a project looks like to someone about to extend it: what is applied, and the values each module would take. */
export interface ProjectState {
  readonly projectFolder: string;
  /** In the order of application. */
  readonly applied: readonly AppliedModule[];
  /**
   * For each module of the catalog, the value of each of its properties if the module were applied now: the value
   * already chosen in the project, else the default. A property whose value cannot be computed (mandatory without
   * default, a recorded value that is no longer valid) has none: the other properties of the module keep theirs.
   */
  readonly presets: Readonly<Record<ModuleSlug, KnownProperties>>;
}

/** The modules to apply together, in the project folder, with the values of the properties they share. */
export interface BasketRequest {
  readonly projectFolder: string;
  readonly modules: readonly ModuleSlug[];
  /** By key, for all the modules of the basket: each one takes those it declares. */
  readonly properties?: Readonly<Record<string, PropertyValue>>;
  /** One policy for the whole basket (`fail` by default). */
  readonly onConflict?: ConflictPolicy;
}

/**
 * `ready`: the module would apply. `conflict`: it cannot, an existing item differs and the policy is `fail`.
 * `blocked`: it cannot (a prerequisite is missing, a value is wrong...). `not-run`: an earlier module stopped the basket.
 */
export type BasketStep =
  | {
      readonly slug: ModuleSlug;
      readonly outcome: 'ready' | 'conflict';
      readonly changes: readonly DecidedChange[];
      readonly report: ApplyReport;
      readonly warnings: readonly string[];
    }
  | {
      readonly slug: ModuleSlug;
      readonly outcome: 'blocked';
      readonly error: string;
      /** The prerequisites that are neither applied nor in the basket, if that is why. */
      readonly missing: readonly ModuleSlug[];
    }
  | { readonly slug: ModuleSlug; readonly outcome: 'not-run'; readonly after: ModuleSlug };

export interface BasketPreview {
  readonly projectFolder: string;
  readonly steps: readonly BasketStep[];
  /** Every module is ready: applying the basket for real would do what the steps say. */
  readonly canApply: boolean;
}

/**
 * `applied`: every module was written and recorded, `steps` says what each one did. `refused`: the basket cannot apply
 * (the preview says why) and nothing was written.
 */
export type BasketApplication =
  | { readonly outcome: 'applied'; readonly projectFolder: string; readonly steps: readonly ApplyResult[] }
  | { readonly outcome: 'refused'; readonly preview: BasketPreview };

/** Orchestration: no business rule here, only the chaining of ports. */
export class ModulesApplicationService {
  private readonly dependencies: ModulesApplicationServiceDependencies;

  constructor(dependencies: ModulesApplicationServiceDependencies) {
    this.dependencies = { ...dependencies, resources: frozenCopy(dependencies.resources) };
  }

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

  /** Read only: nothing is written, not even in a folder that does not exist yet. */
  projectState(projectFolder: string): ProjectState {
    const applied = this.dependencies.history.list(projectFolder);
    const known = mergedProperties(applied);
    const presets = Object.fromEntries(
      this.dependencies.resources.map((resource) => [
        resource.slug,
        resource.propertiesDefinition.presets(projectFolder, known),
      ]),
    );
    return { projectFolder, applied, presets };
  }

  /**
   * Plays the basket on a copy of the project, in the order the catalog lists the modules (after the modules they
   * depend on), and says what each module would do. Nothing is written, not even in the history.
   * The first module that cannot be applied stops the basket, like it would when applying: the others are not run.
   */
  previewBasket({ projectFolder, modules, properties = {}, onConflict = 'fail' }: BasketRequest): BasketPreview {
    const resources = this.inCatalogOrder(modules);
    this.checkBasketProperties(resources, properties);

    const { files, history } = this.dependencies.simulator.start();
    const simulation = new ModulesApplicationService({ ...this.dependencies, files, history });

    const steps: BasketStep[] = [];
    for (const resource of resources) {
      const stopper = steps.find(({ outcome }) => outcome !== 'ready');
      steps.push(
        stopper === undefined
          ? simulation.tryStep(resource, { projectFolder, ...propertiesDeclaredBy(resource, properties) }, onConflict)
          : { slug: resource.slug, outcome: 'not-run', after: stopper.slug },
      );
    }
    return { projectFolder, steps, canApply: steps.every(({ outcome }) => outcome === 'ready') };
  }

  /**
   * Applies the basket to the project, module after module, in the order of the preview. The basket is played on a
   * copy first: if it cannot apply (a conflict, a missing prerequisite, a wrong value), nothing is written, not even
   * the modules that would have been ready.
   * A failure of the file system while writing can still leave the project partly written: the modules written before
   * it stay recorded, the error is not hidden, and applying the rest again completes the project.
   */
  applyBasket(request: BasketRequest): BasketApplication {
    const preview = this.previewBasket(request);
    if (!preview.canApply) {
      return { outcome: 'refused', preview };
    }

    const { projectFolder, modules, properties = {}, onConflict = 'fail' } = request;
    const steps: ApplyResult[] = [];
    for (const resource of this.inCatalogOrder(modules)) {
      steps.push(
        this.apply(resource.slug, { projectFolder, ...propertiesDeclaredBy(resource, properties) }, { onConflict }),
      );
    }
    return { outcome: 'applied', projectFolder, steps };
  }

  /** The module is played for real on the simulation, so that the following ones see what it wrote. */
  private tryStep(resource: ModuleResource, raw: RawProperties, onConflict: ConflictPolicy): BasketStep {
    const { slug } = resource;
    try {
      const { changes, report, warnings } = this.apply(slug, raw, { onConflict, dryRun: true });
      if (report.conflicts > 0) {
        return { slug, outcome: 'conflict', changes, report, warnings };
      }
      this.apply(slug, raw, { onConflict });
      return { slug, outcome: 'ready', changes, report, warnings };
    } catch (error) {
      if (!(error instanceof CraftTypeError)) {
        throw error;
      }
      const missing = error instanceof MissingModuleDependenciesError ? error.missing : [];
      return { slug, outcome: 'blocked', error: error.message, missing };
    }
  }

  private inCatalogOrder(slugs: readonly ModuleSlug[]): ModuleResource[] {
    const wanted = new Set(slugs.map((slug) => this.find(slug).slug));
    return this.dependencies.resources.filter(({ slug }) => wanted.has(slug));
  }

  private checkBasketProperties(
    resources: readonly ModuleResource[],
    properties: Readonly<Record<string, PropertyValue>>,
  ): void {
    const declared = new Set(
      resources.flatMap(({ propertiesDefinition }) => propertiesDefinition.custom.map(({ key }) => key)),
    );
    for (const key of Object.keys(properties)) {
      if (!declared.has(key)) {
        throw new InvalidPropertyError(key, 'not supported by any module of the basket');
      }
    }
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

  /** Properties already set by the applied modules of the project; the most recent one wins. */
  private knownProperties(projectFolder: PropertyValue | undefined): KnownProperties {
    const folder = String(projectFolder ?? '');
    return folder.trim() === '' ? {} : mergedProperties(this.dependencies.history.list(folder));
  }

  private checkDependencies(resource: ModuleResource, properties: ModuleProperties): void {
    const applied = new Set(this.dependencies.history.list(properties.projectFolder).map(({ slug }) => slug));
    const missing = resource.dependsOn.filter((slug) => !applied.has(slug));

    if (missing.length > 0) {
      throw new MissingModuleDependenciesError(resource.slug, missing);
    }
  }
}

/** Only the properties the module declares (the ones it does not know are refused); a value not given is `undefined`. */
const propertiesDeclaredBy = (
  { propertiesDefinition }: ModuleResource,
  properties: Readonly<Record<string, PropertyValue>>,
): RawProperties => Object.fromEntries(propertiesDefinition.custom.map(({ key }) => [key, properties[key]]));

const mergedProperties = (applied: readonly AppliedModule[]): KnownProperties =>
  applied.reduce<KnownProperties>((known, { properties }) => ({ ...known, ...properties }), {});

const sameProperties = (left: KnownProperties, right: KnownProperties): boolean => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
};
