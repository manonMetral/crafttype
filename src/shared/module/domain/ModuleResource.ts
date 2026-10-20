import type { ModulePropertiesDefinition, ModuleProperties } from './ModuleProperties.js';
import type { CraftModule } from './CraftModule.js';

export type ModuleSlug = string;

/** Décrit comment un module s'organise dans le catalogue (équivalent de Seed4JModuleResource). */
export interface ModuleResource {
  readonly slug: ModuleSlug;
  readonly propertiesDefinition: ModulePropertiesDefinition;
  readonly apiDoc: { readonly group: string; readonly operation: string };
  /** Modules à appliquer avant celui-ci. Vide pour un module autonome (`standalone`). */
  readonly dependsOn: readonly ModuleSlug[];
  readonly tags: readonly string[];
  readonly factory: (properties: ModuleProperties) => CraftModule;
}

/** Builder à étapes ordonnées, comme `Seed4JModuleResource.builder()`. */
export interface SlugStep {
  slug(slug: ModuleSlug): PropertiesStep;
}
export interface PropertiesStep {
  propertiesDefinition(definition: ModulePropertiesDefinition): ApiDocStep;
}
export interface ApiDocStep {
  apiDoc(group: string, operation: string): OrganizationStep;
}
export interface OrganizationStep {
  standalone(): TagsStep;
  dependsOn(...slugs: ModuleSlug[]): TagsStep;
}
export interface TagsStep {
  tags(...tags: string[]): FactoryStep;
}
export interface FactoryStep {
  factory(factory: (properties: ModuleProperties) => CraftModule): ModuleResource;
}

export const moduleResource = (): SlugStep => ({
  slug: (slug) => ({
    propertiesDefinition: (propertiesDefinition) => ({
      apiDoc: (group, operation) => ({
        standalone: () => tagsStep({ slug, propertiesDefinition, apiDoc: { group, operation }, dependsOn: [] }),
        dependsOn: (...slugs) =>
          tagsStep({ slug, propertiesDefinition, apiDoc: { group, operation }, dependsOn: slugs }),
      }),
    }),
  }),
});

type Partial1 = Omit<ModuleResource, 'tags' | 'factory'>;

const tagsStep = (partial: Partial1): TagsStep => ({
  tags: (...tags) => ({
    factory: (factory) => ({ ...partial, tags, factory }),
  }),
});
