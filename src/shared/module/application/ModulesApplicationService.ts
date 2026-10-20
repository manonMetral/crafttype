import { MissingModuleDependenciesError, ModuleConflictError, UnknownModuleError } from '../domain/errors.js';
import { isRecord, parseJsonObject } from '../domain/jsonFile.js';
import type { KnownProperties, ModuleProperties, RawProperties } from '../domain/ModuleProperties.js';
import type { ModuleResource, ModuleSlug } from '../domain/ModuleResource.js';
import type { CraftModule } from '../domain/CraftModule.js';
import type {
  AppliedModule,
  ModulesHistory,
  ModuleResourcesReader,
  ProjectFiles,
  TemplateRenderer,
} from '../domain/ports.js';

const PACKAGE_JSON = 'package.json';

export interface ModulesApplicationServiceDependencies {
  readonly resources: readonly ModuleResource[];
  readonly files: ProjectFiles;
  readonly resourcesReader: ModuleResourcesReader;
  readonly renderer: TemplateRenderer;
  readonly history: ModulesHistory;
  readonly clock: () => Date;
}

export interface ApplyOptions {
  /** Remplace les fichiers et les entrées du package.json existants qui diffèrent, au lieu de refuser. */
  readonly force?: boolean;
}

interface PackageJsonPlan {
  readonly content: string;
  readonly conflicts: readonly string[];
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

  apply(slug: ModuleSlug, raw: RawProperties, options: ApplyOptions = {}): AppliedModule {
    const { resource, properties, module } = this.buildModule(slug, raw, this.knownProperties(raw.projectFolder));

    this.checkDependencies(resource, properties);
    this.applyModule(module, options);

    const applied: AppliedModule = {
      slug,
      properties: resource.propertiesDefinition.portable(properties),
      appliedAt: this.dependencies.clock().toISOString(),
    };
    this.dependencies.history.record(properties.projectFolder, applied);
    return applied;
  }

  /**
   * Applique un module sans passer par le catalogue ni l'historique (utilisé par les tests de module).
   * Rien n'est écrit si un fichier ou une entrée du package.json existant serait écrasé par un contenu différent,
   * sauf avec `force`. Réappliquer un module à l'identique ne change rien.
   */
  applyModule(module: CraftModule, { force = false }: ApplyOptions = {}): void {
    const { files, resourcesReader, renderer } = this.dependencies;

    const writes = module.files
      .map((file) => {
        const content = resourcesReader.read(file.module, file.path);
        return { path: file.destination, content: file.rendered ? renderer.render(content, module.context) : content };
      })
      .filter(({ path, content }) => files.read(module.projectFolder, path) !== content);
    const packageJson = this.planPackageJson(module);

    const conflicts = [
      ...writes.filter(({ path }) => files.read(module.projectFolder, path) !== undefined).map(({ path }) => path),
      ...(packageJson?.conflicts ?? []),
    ];
    if (conflicts.length > 0 && !force) {
      throw new ModuleConflictError(conflicts);
    }

    for (const { path, content } of writes) {
      files.write(module.projectFolder, path, content);
    }
    if (packageJson !== undefined) {
      files.write(module.projectFolder, PACKAGE_JSON, packageJson.content);
    }
  }

  /** Propriétés déjà posées par les modules appliqués ; le plus récent l'emporte. */
  private knownProperties(projectFolder: string | number | undefined): KnownProperties {
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

  private planPackageJson(module: CraftModule): PackageJsonPlan | undefined {
    const { fields, dependencies, devDependencies, scripts } = module.packageJson;
    const hasChanges = [fields, dependencies, devDependencies, scripts].some((part) => Object.keys(part).length > 0);
    if (!hasChanges) {
      return undefined;
    }

    const existing = this.dependencies.files.read(module.projectFolder, PACKAGE_JSON);
    const current = existing === undefined ? {} : parseJsonObject(PACKAGE_JSON, existing);

    const merged = {
      ...current,
      ...fields,
      scripts: { ...asRecord(current['scripts']), ...scripts },
      dependencies: sortKeys({ ...asRecord(current['dependencies']), ...dependencies }),
      devDependencies: sortKeys({ ...asRecord(current['devDependencies']), ...devDependencies }),
    };

    const conflicts = [
      ...differences('', fields, current),
      ...differences('scripts.', scripts, asRecord(current['scripts'])),
      ...differences('dependencies.', dependencies, asRecord(current['dependencies'])),
      ...differences('devDependencies.', devDependencies, asRecord(current['devDependencies'])),
    ];

    return { content: `${JSON.stringify(removeEmpty(merged), null, 2)}\n`, conflicts };
  }
}

/** Entrées déjà présentes avec une autre valeur que celle que le module veut poser. */
const differences = (prefix: string, wanted: Readonly<Record<string, unknown>>, existing: Record<string, unknown>): string[] =>
  Object.entries(wanted)
    .filter(([key, value]) => existing[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(value))
    .map(([key, value]) => `${PACKAGE_JSON} : ${prefix}${key} (existant : ${JSON.stringify(existing[key])}, module : ${JSON.stringify(value)})`);

const asRecord = (value: unknown): Record<string, string> => (isRecord(value) ? (value as Record<string, string>) : {});

const sortKeys = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const removeEmpty = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => !(typeof value === 'object' && value !== null && Object.keys(value).length === 0)));
