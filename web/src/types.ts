/** What the API of `crafttype ui` sends: the same shapes as `src/shared/module/infrastructure/primary/web/api.ts`. */
export type PropertyType = 'string' | 'number' | 'boolean';
export type PropertyValue = string | number | boolean;

export interface PropertyInfo {
  readonly key: string;
  readonly type: PropertyType;
  readonly mandatory: boolean;
  readonly description: string;
}

export interface ModuleInfo {
  readonly slug: string;
  readonly group: string;
  readonly description: string;
  readonly dependsOn: readonly string[];
  readonly tags: readonly string[];
  readonly properties: readonly PropertyInfo[];
}

export interface Catalog {
  readonly modules: readonly ModuleInfo[];
}

export interface ProjectState {
  readonly projectFolder: string;
  readonly applied: readonly { readonly slug: string; readonly appliedAt: string }[];
  /** For each module, the value each of its properties would take. */
  readonly presets: Readonly<Record<string, Readonly<Record<string, PropertyValue>>>>;
}
