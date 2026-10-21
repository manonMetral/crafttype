import type { ModuleSlug } from './ModuleResource.js';
import type { KnownProperties } from './ModuleProperties.js';
import type { TemplateContext } from './CraftModule.js';

/** Port: reads from and writes to the generated project. */
export interface ProjectFiles {
  read(projectFolder: string, path: string): string | undefined;
  write(projectFolder: string, path: string, content: string): void;
}

/** Port: reads the source files of a module (resources/generator/<module>/). */
export interface ModuleResourcesReader {
  read(module: string, path: string): string;
}

/** Port: renders a template. */
export interface TemplateRenderer {
  render(template: string, context: TemplateContext): string;
}

export interface AppliedModule {
  readonly slug: ModuleSlug;
  /**
   * Only the properties the module declares, and without `projectFolder` (the local path makes no sense
   * once the project is moved or cloned). Following modules reuse them as default values.
   */
  readonly properties: KnownProperties;
  readonly appliedAt: string;
}

/** Port: history of the applied modules (`.crafttype/modules/history.json` in the project). */
export interface ModulesHistory {
  list(projectFolder: string): readonly AppliedModule[];
  record(projectFolder: string, applied: AppliedModule): void;
}

/**
 * Port: should the version already present in the project be kept rather than the catalog's?
 * Yes if it accepts the catalog version (`^5.0.0` for `5.12.7`) or is greater than or equal to it:
 * this is the case of a project whose versions Renovate has already bumped. An older version, a tag
 * (`latest`), a URL or a workspace reference cannot be compared: the module cannot safely keep it,
 * so it is a conflict.
 */
export interface VersionComparator {
  keepsExistingVersion(existing: string, wanted: string): boolean;
}
