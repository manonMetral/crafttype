import { posix } from 'node:path';
import { DuplicateDestinationError } from './errors.js';
import type { ModuleProperties } from './ModuleProperties.js';
import type { PackageVersions } from './PackageVersions.js';

export interface FileToAdd {
  /** Module propriétaire du dossier `resources/generator/<module>/`. */
  readonly module: string;
  readonly path: string;
  /** `true` pour un template mustache, `false` pour une copie brute. */
  readonly rendered: boolean;
  readonly destination: string;
}

export interface PackageJsonChanges {
  /** Champs posés tels quels (`name`, `type`, `engines`...). Réservé aux modules propriétaires, comme `init`. */
  readonly fields: Readonly<Record<string, unknown>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly scripts: Readonly<Record<string, string>>;
}

export type TemplateContext = Readonly<Record<string, string | number | boolean>>;

/** Décrit les modifications qu'un module apporte au projet généré (équivalent de Seed4JModule). */
export interface CraftModule {
  readonly projectFolder: string;
  readonly files: readonly FileToAdd[];
  readonly packageJson: PackageJsonChanges;
  readonly context: TemplateContext;
}

/** Désigne les fichiers sources d'un module : `from('fastify-server').template('app.ts')`. */
export class ModuleSource {
  constructor(readonly module: string) {}

  template(path: string): { module: string; path: string; rendered: true } {
    return { module: this.module, path: `${path}.mustache`, rendered: true };
  }

  file(path: string): { module: string; path: string; rendered: false } {
    return { module: this.module, path, rendered: false };
  }
}

export const from = (module: string): ModuleSource => new ModuleSource(module);

type Source = ReturnType<ModuleSource['template']> | ReturnType<ModuleSource['file']>;

export class CraftModuleBuilder {
  private readonly files: FileToAdd[] = [];
  private readonly dependencies: Record<string, string> = {};
  private readonly devDependencies: Record<string, string> = {};
  private readonly scripts: Record<string, string> = {};
  private readonly fields: Record<string, unknown> = {};
  private readonly extraContext: Record<string, string | number | boolean> = {};

  constructor(private readonly properties: ModuleProperties) {}

  addFile(source: Source, destination: string): this {
    const normalized = posix.normalize(destination);
    if (this.files.some((file) => file.destination === normalized)) {
      throw new DuplicateDestinationError(normalized);
    }
    this.files.push({ ...source, destination: normalized });
    return this;
  }

  addDependency(packageName: string, versions: PackageVersions): this {
    this.dependencies[packageName] = versions.get(packageName);
    return this;
  }

  addDevDependency(packageName: string, versions: PackageVersions): this {
    this.devDependencies[packageName] = versions.get(packageName);
    return this;
  }

  addScript(name: string, command: string): this {
    this.scripts[name] = command;
    return this;
  }

  setPackageJsonField(key: string, value: unknown): this {
    this.fields[key] = value;
    return this;
  }

  addContext(key: string, value: string | number | boolean): this {
    this.extraContext[key] = value;
    return this;
  }

  build(): CraftModule {
    return {
      projectFolder: this.properties.projectFolder,
      files: [...this.files],
      packageJson: {
        fields: { ...this.fields },
        dependencies: { ...this.dependencies },
        devDependencies: { ...this.devDependencies },
        scripts: { ...this.scripts },
      },
      context: {
        ...this.properties.values,
        ...this.extraContext,
      },
    };
  }
}

export const moduleBuilder = (properties: ModuleProperties): CraftModuleBuilder => new CraftModuleBuilder(properties);
