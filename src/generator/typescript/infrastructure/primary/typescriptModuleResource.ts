import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { TypescriptFactory } from '../../domain/TypescriptFactory.js';

export const typescriptSlug = 'typescript';

export const createTypescriptModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const factory = new TypescriptFactory(versions);

  return moduleResource()
    .slug(typescriptSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('TypeScript', 'Ajoute TypeScript et sa configuration')
    .dependsOn('init')
    .tags('setup')
    .factory((properties) => factory.buildModule(properties));
};
