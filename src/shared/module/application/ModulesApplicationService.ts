import { MissingModuleDependenciesError, UnknownModuleError } from '../domain/errors.js';
import type { ModuleProperties, RawProperties } from '../domain/ModuleProperties.js';
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

  buildModule(slug: ModuleSlug, raw: RawProperties): { resource: ModuleResource; properties: ModuleProperties; module: CraftModule } {
    const resource = this.find(slug);
    const properties = resource.propertiesDefinition.resolve(raw);
    return { resource, properties, module: resource.factory(properties) };
  }

  apply(slug: ModuleSlug, raw: RawProperties): AppliedModule {
    const { resource, properties, module } = this.buildModule(slug, raw);

    this.checkDependencies(resource, properties);
    this.applyModule(module);

    const { projectFolder: _, ...portableProperties } = properties;
    const applied: AppliedModule = { slug, properties: portableProperties, appliedAt: this.dependencies.clock().toISOString() };
    this.dependencies.history.record(properties.projectFolder, applied);
    return applied;
  }

  /** Applique un module sans passer par le catalogue ni l'historique (utilisé par les tests de module). */
  applyModule(module: CraftModule): void {
    const { files, resourcesReader, renderer } = this.dependencies;

    for (const file of module.files) {
      const content = resourcesReader.read(file.module, file.path);
      files.write(module.projectFolder, file.destination, file.rendered ? renderer.render(content, module.context) : content);
    }

    this.mergePackageJson(module);
  }

  private checkDependencies(resource: ModuleResource, properties: ModuleProperties): void {
    const applied = new Set(this.dependencies.history.list(properties.projectFolder).map(({ slug }) => slug));
    const missing = resource.dependsOn.filter((slug) => !applied.has(slug));

    if (missing.length > 0) {
      throw new MissingModuleDependenciesError(resource.slug, missing);
    }
  }

  private mergePackageJson(module: CraftModule): void {
    const { fields, dependencies, devDependencies, scripts } = module.packageJson;
    const hasChanges = [fields, dependencies, devDependencies, scripts].some((part) => Object.keys(part).length > 0);
    if (!hasChanges) {
      return;
    }

    const { files } = this.dependencies;
    const existing = files.read(module.projectFolder, PACKAGE_JSON);
    const current: Record<string, unknown> = existing === undefined ? {} : JSON.parse(existing);

    const merged = {
      ...current,
      ...fields,
      scripts: { ...asRecord(current['scripts']), ...scripts },
      dependencies: sortKeys({ ...asRecord(current['dependencies']), ...dependencies }),
      devDependencies: sortKeys({ ...asRecord(current['devDependencies']), ...devDependencies }),
    };

    files.write(module.projectFolder, PACKAGE_JSON, `${JSON.stringify(removeEmpty(merged), null, 2)}\n`);
  }
}

const asRecord = (value: unknown): Record<string, string> => (typeof value === 'object' && value !== null ? (value as Record<string, string>) : {});

const sortKeys = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const removeEmpty = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => !(typeof value === 'object' && value !== null && Object.keys(value).length === 0)));
