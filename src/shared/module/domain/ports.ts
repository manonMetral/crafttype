import type { ModuleSlug } from './ModuleResource.js';
import type { KnownProperties } from './ModuleProperties.js';
import type { TemplateContext } from './CraftModule.js';

/** Port : écrit dans le projet généré. */
export interface ProjectFiles {
  read(projectFolder: string, path: string): string | undefined;
  write(projectFolder: string, path: string, content: string): void;
}

/** Port : lit les fichiers sources d'un module (resources/generator/<module>/). */
export interface ModuleResourcesReader {
  read(module: string, path: string): string;
}

/** Port : rend un template. */
export interface TemplateRenderer {
  render(template: string, context: TemplateContext): string;
}

export interface AppliedModule {
  readonly slug: ModuleSlug;
  /**
   * Seulement les propriétés que le module déclare, et sans `projectFolder` (le chemin local n'a pas de sens
   * une fois le projet déplacé ou cloné). Les modules suivants les réutilisent comme valeurs par défaut.
   */
  readonly properties: KnownProperties;
  readonly appliedAt: string;
}

/** Port : historique des modules appliqués (`.crafttype/modules/history.json` dans le projet). */
export interface ModulesHistory {
  list(projectFolder: string): readonly AppliedModule[];
  record(projectFolder: string, applied: AppliedModule): void;
}
