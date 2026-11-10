import type { ModulePropertiesDefinition, ModuleProperties } from './ModuleProperties.js';
import type { CraftModule } from './CraftModule.js';
import { frozenCopy } from './frozen.js';

export type ModuleSlug = string;
/** What a module brings to the project (a `front`, a test runner...), whichever module brings it. */
export type Capability = string;

/** Describes how a module is organized in the catalog (equivalent of Seed4JModuleResource). */
export interface ModuleResource {
  readonly slug: ModuleSlug;
  readonly propertiesDefinition: ModulePropertiesDefinition;
  readonly apiDoc: { readonly group: string; readonly operation: string };
  /** Modules to apply before this one. Empty for a standalone module (`standalone`). */
  readonly dependsOn: readonly ModuleSlug[];
  /** Capabilities this module needs: a module that provides each of them must be applied before it, whichever it is. */
  readonly requires: readonly Capability[];
  /** What this module brings, for the modules that require it. A project has at most one module per capability. */
  readonly provides: readonly Capability[];
  readonly tags: readonly string[];
  readonly factory: (properties: ModuleProperties) => CraftModule;
}

/** Builder with ordered steps, like `Seed4JModuleResource.builder()`. */
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
  standalone(): RelationsStep;
  dependsOn(...slugs: ModuleSlug[]): RelationsStep;
}
/** What the module requires and provides, if anything: optional, in any order. */
export interface RelationsStep extends TagsStep {
  requires(...capabilities: Capability[]): RelationsStep;
  provides(...capabilities: Capability[]): RelationsStep;
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
      apiDoc: (group, operation) => {
        const named = { slug, propertiesDefinition, apiDoc: { group, operation } };
        return {
          standalone: () => relationsStep({ ...named, dependsOn: [] }),
          dependsOn: (...slugs) => relationsStep({ ...named, dependsOn: slugs }),
        };
      },
    }),
  }),
});

type Named = Omit<ModuleResource, 'requires' | 'provides' | 'tags' | 'factory'>;

const relationsStep = (
  named: Named,
  requires: readonly Capability[] = [],
  provides: readonly Capability[] = [],
): RelationsStep => ({
  requires: (...capabilities) => relationsStep(named, [...requires, ...capabilities], provides),
  provides: (...capabilities) => relationsStep(named, requires, [...provides, ...capabilities]),
  tags: (...tags) => ({
    factory: (factory) => ({
      ...named,
      requires: unique(requires),
      provides: unique(provides),
      tags,
      factory,
    }),
  }),
});

/** Each capability once, and a list nobody can modify. */
const unique = (capabilities: readonly Capability[]): readonly Capability[] => frozenCopy([...new Set(capabilities)]);
