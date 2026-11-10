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

export type ConflictPolicy = 'fail' | 'skip' | 'overwrite';

export type Decision = 'create' | 'edit' | 'unchanged' | 'keep' | 'overwrite' | 'skip' | 'conflict';

export interface ChangeInfo {
  readonly kind: string;
  readonly target: string;
  readonly decision: Decision;
  /** Readable: the file, or the package.json entry with the existing value against the module's. */
  readonly description: string;
}

export interface ReportInfo {
  readonly created: number;
  readonly edited: number;
  readonly replaced: number;
  readonly unchanged: number;
  readonly kept: number;
  readonly skipped: number;
  readonly conflicts: number;
}

/** `ready`: it would apply. `conflict`: an existing item differs. `blocked`: it cannot. `not-run`: an earlier step stopped the basket. */
export type StepInfo =
  | {
      readonly slug: string;
      readonly outcome: 'ready' | 'conflict';
      readonly report: ReportInfo;
      readonly warnings: readonly string[];
      readonly changes: readonly ChangeInfo[];
    }
  | { readonly slug: string; readonly outcome: 'blocked'; readonly error: string; readonly missing: readonly string[] }
  | { readonly slug: string; readonly outcome: 'not-run'; readonly after: string };

/** The request of a preview and of an application: the same basket, so that what is written is what was previewed. */
export interface PreviewRequest {
  readonly projectFolder?: string;
  readonly modules: readonly string[];
  readonly properties?: Readonly<Record<string, PropertyValue>>;
  readonly onConflict?: ConflictPolicy;
}

export interface BasketPreview {
  readonly projectFolder: string;
  readonly steps: readonly StepInfo[];
  readonly canApply: boolean;
}

/** What a module did when the basket was written. */
export interface AppliedStepInfo {
  readonly slug: string;
  readonly report: ReportInfo;
  readonly warnings: readonly string[];
  readonly changes: readonly ChangeInfo[];
}

/** `applied`: every module was written, in the order of `steps`. `refused`: the basket cannot apply, nothing was written. */
export type ApplyResult =
  | { readonly outcome: 'applied'; readonly projectFolder: string; readonly steps: readonly AppliedStepInfo[] }
  | { readonly outcome: 'refused'; readonly preview: BasketPreview };
