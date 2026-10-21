import {
  ChangePlan,
  reportOf,
  type ApplyReport,
  type ChangeKind,
  type ConflictPolicy,
  type DecidedChange,
  type PlannedChange,
} from '../domain/ChangePlan.js';
import { MissingModuleDependenciesError, NeedleError, UnknownModuleError } from '../domain/errors.js';
import { isRecord, parseJsonObject } from '../domain/jsonFile.js';
import { insertAtNeedle, needleToken, type FileEdit } from '../domain/needles.js';
import type { KnownProperties, ModuleProperties, PropertyValue, RawProperties } from '../domain/ModuleProperties.js';
import type { ModuleResource, ModuleSlug } from '../domain/ModuleResource.js';
import type { CraftModule } from '../domain/CraftModule.js';
import type {
  AppliedModule,
  ModulesHistory,
  ModuleResourcesReader,
  ProjectFiles,
  TemplateRenderer,
  VersionComparator,
} from '../domain/ports.js';

const PACKAGE_JSON = 'package.json';

export interface ModulesApplicationServiceDependencies {
  readonly resources: readonly ModuleResource[];
  readonly files: ProjectFiles;
  readonly resourcesReader: ModuleResourcesReader;
  readonly renderer: TemplateRenderer;
  readonly history: ModulesHistory;
  readonly versions: VersionComparator;
  readonly clock: () => Date;
}

export interface ApplyOptions {
  /** `fail` (défaut) refuse le module s'il y a un conflit, `overwrite` remplace l'existant, `skip` le garde. */
  readonly onConflict?: ConflictPolicy;
  /** Calcule et renvoie les changements sans rien écrire, ni dans le projet ni dans l'historique. */
  readonly dryRun?: boolean;
}

export interface ApplyResult {
  readonly slug: ModuleSlug;
  readonly dryRun: boolean;
  readonly changes: readonly DecidedChange[];
  readonly report: ApplyReport;
}

/** Orchestration : aucune règle métier ici, uniquement l'enchaînement des ports. */
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
    const { resource, properties, module } = this.buildModule(slug, raw, this.knownProperties(raw.projectFolder));

    this.checkDependencies(resource, properties);
    const plan = this.plan(module);

    if (dryRun) {
      const changes = plan.decide(onConflict);
      return { slug, dryRun, changes, report: reportOf(changes) };
    }

    const changes = plan.resolve(onConflict);
    this.write(module, changes);

    this.dependencies.history.record(properties.projectFolder, {
      slug,
      properties: resource.propertiesDefinition.portable(properties),
      appliedAt: this.dependencies.clock().toISOString(),
    });
    return { slug, dryRun, changes, report: reportOf(changes) };
  }

  /**
   * Applique un module sans passer par le catalogue ni l'historique (utilisé par les tests de module).
   * Rien n'est écrit si un fichier ou une entrée du package.json existant serait écrasé par un contenu différent,
   * sauf si la politique l'autorise. Réappliquer un module à l'identique ne change rien.
   */
  applyModule(module: CraftModule, { onConflict = 'fail' }: Pick<ApplyOptions, 'onConflict'> = {}): ApplyReport {
    const changes = this.plan(module).resolve(onConflict);
    this.write(module, changes);
    return reportOf(changes);
  }

  /** Ce que le module changerait dans le projet, d'après l'état actuel des fichiers. */
  private plan(module: CraftModule): ChangePlan {
    const { files, resourcesReader, renderer } = this.dependencies;
    const { projectFolder, packageJson } = module;

    const fileChanges = module.files.map((file) => {
      const content = resourcesReader.read(file.module, file.path);
      const next = file.rendered ? renderer.render(content, module.context) : content;
      return { kind: 'file' as const, target: file.destination, current: files.read(projectFolder, file.destination), next };
    });

    const editChanges = this.planEdits(module);

    const sections: readonly [ChangeKind, Readonly<Record<string, unknown>>, string | undefined][] = [
      ['field', packageJson.fields, undefined],
      ['script', packageJson.scripts, 'scripts'],
      ['dependency', packageJson.dependencies, 'dependencies'],
      ['devDependency', packageJson.devDependencies, 'devDependencies'],
    ];
    if (sections.every(([, wanted]) => Object.keys(wanted).length === 0)) {
      return new ChangePlan([...fileChanges, ...editChanges], this.dependencies.versions);
    }

    const current = this.readPackageJson(projectFolder);
    const packageJsonChanges = sections.flatMap(([kind, wanted, section]) => {
      const existing = section === undefined ? current : asRecord(current[section]);
      return Object.entries(wanted).map(([target, value]) => ({
        kind,
        target,
        current: existing[target] === undefined ? undefined : JSON.stringify(existing[target]),
        next: JSON.stringify(value),
      }));
    });
    return new ChangePlan([...fileChanges, ...editChanges, ...packageJsonChanges], this.dependencies.versions);
  }

  /** Un changement par fichier modifié : les insertions d'un même fichier s'enchaînent dans l'ordre où le module les déclare. */
  private planEdits({ projectFolder, edits }: CraftModule): PlannedChange[] {
    const byPath = new Map<string, FileEdit[]>();
    for (const edit of edits) {
      byPath.set(edit.path, [...(byPath.get(edit.path) ?? []), edit]);
    }

    return [...byPath].map(([path, fileEdits]) => {
      const current = this.dependencies.files.read(projectFolder, path);
      if (current === undefined) {
        throw new NeedleError(path, needleToken(fileEdits[0]?.needle ?? ''), 'fichier introuvable : appliquez d\'abord le module qui le crée');
      }
      return { kind: 'edit' as const, target: path, current, next: fileEdits.reduce(insertAtNeedle, current) };
    });
  }

  /** Écrit uniquement ce qui est à créer, à modifier ou à remplacer, pour ne pas toucher aux fichiers déjà à jour. */
  private write(module: CraftModule, changes: readonly DecidedChange[]): void {
    const { files } = this.dependencies;
    const toWrite = changes.filter(({ decision }) => decision === 'create' || decision === 'edit' || decision === 'overwrite');

    for (const { kind, target, next } of toWrite) {
      if (kind === 'file' || kind === 'edit') {
        files.write(module.projectFolder, target, next);
      }
    }

    const packageJsonChanges = toWrite.filter(({ kind }) => kind !== 'file' && kind !== 'edit');
    if (packageJsonChanges.length === 0) {
      return;
    }

    const packageJson = this.readPackageJson(module.projectFolder);
    const touched = new Set<string>();
    for (const { kind, target, next } of packageJsonChanges) {
      const section = SECTIONS[kind as Exclude<ChangeKind, 'file' | 'edit'>];
      if (section === undefined) {
        packageJson[target] = JSON.parse(next);
        continue;
      }
      const entries = asRecord(packageJson[section]);
      entries[target] = JSON.parse(next);
      packageJson[section] = entries;
      touched.add(section);
    }
    for (const section of ['dependencies', 'devDependencies']) {
      if (touched.has(section)) {
        packageJson[section] = sortKeys(asRecord(packageJson[section]));
      }
    }

    files.write(module.projectFolder, PACKAGE_JSON, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  private readPackageJson(projectFolder: string): Record<string, unknown> {
    const existing = this.dependencies.files.read(projectFolder, PACKAGE_JSON);
    return existing === undefined ? {} : parseJsonObject(PACKAGE_JSON, existing);
  }

  /** Propriétés déjà posées par les modules appliqués ; le plus récent l'emporte. */
  private knownProperties(projectFolder: PropertyValue | undefined): KnownProperties {
    const folder = String(projectFolder ?? '');
    if (folder.trim() === '') {
      return {};
    }
    return this.dependencies.history.list(folder).reduce<KnownProperties>((known, { properties }) => ({ ...known, ...properties }), {});
  }

  private checkDependencies(resource: ModuleResource, properties: ModuleProperties): void {
    const applied = new Set(this.dependencies.history.list(properties.projectFolder).map(({ slug }) => slug));
    const missing = resource.dependsOn.filter((slug) => !applied.has(slug));

    if (missing.length > 0) {
      throw new MissingModuleDependenciesError(resource.slug, missing);
    }
  }
}

const SECTIONS: Record<Exclude<ChangeKind, 'file' | 'edit'>, string | undefined> = {
  field: undefined,
  script: 'scripts',
  dependency: 'dependencies',
  devDependency: 'devDependencies',
};

const asRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? { ...value } : {});

const sortKeys = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
