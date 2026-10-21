import { NeedleError } from './errors.js';
import { isValidNeedleName, type FileEdit } from './needles.js';
import type { ModuleProperties } from './ModuleProperties.js';
import type { PackageVersions } from './PackageVersions.js';

export interface FileToAdd {
  /** Module that owns the `resources/generator/<module>/` folder. */
  readonly module: string;
  readonly path: string;
  /** `true` for a mustache template, `false` for a raw copy. */
  readonly rendered: boolean;
  readonly destination: string;
}

export interface PackageJsonChanges {
  /** Fields set as is (`name`, `type`, `engines`...). Reserved for owner modules, like `init`. */
  readonly fields: Readonly<Record<string, unknown>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly scripts: Readonly<Record<string, string>>;
}

export type TemplateContext = Readonly<Record<string, string | number | boolean>>;

/** Describes the changes a module makes to the generated project (equivalent of Seed4JModule). */
export interface CraftModule {
  readonly projectFolder: string;
  readonly files: readonly FileToAdd[];
  /** Insertions into files that already exist in the project (created by another module). */
  readonly edits: readonly FileEdit[];
  readonly packageJson: PackageJsonChanges;
  readonly context: TemplateContext;
}

/** Designates the source files of a module: `from('fastify-server').template('app.ts')`. */
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
  private readonly edits: FileEdit[] = [];
  private readonly dependencies: Record<string, string> = {};
  private readonly devDependencies: Record<string, string> = {};
  private readonly scripts: Record<string, string> = {};
  private readonly fields: Record<string, unknown> = {};

  constructor(private readonly properties: ModuleProperties) {}

  addFile(source: Source, destination: string): this {
    this.files.push({ ...source, destination });
    return this;
  }

  /**
   * Adds `content` to a file that is already present, just before the line that contains `crafttype-needle-<needle>`.
   * The module that creates this file must place the needle in it (see `documentation/module-creation.md`).
   */
  insertAtNeedle(path: string, needle: string, content: string): this {
    if (!isValidNeedleName(needle)) {
      throw new NeedleError(path, needle, 'invalid needle name (lowercase letters, digits and hyphens)');
    }
    this.edits.push({ path, needle, content });
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

  build(): CraftModule {
    return {
      projectFolder: this.properties.projectFolder,
      files: [...this.files],
      edits: [...this.edits],
      packageJson: {
        fields: { ...this.fields },
        dependencies: { ...this.dependencies },
        devDependencies: { ...this.devDependencies },
        scripts: { ...this.scripts },
      },
      context: { ...this.properties.values },
    };
  }
}

export const moduleBuilder = (properties: ModuleProperties): CraftModuleBuilder => new CraftModuleBuilder(properties);
