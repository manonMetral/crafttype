import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { TypescriptApplicationService } from '../../application/TypescriptApplicationService.js';

export const typescriptSlug = 'typescript';

export const createTypescriptModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new TypescriptApplicationService(versions);

  return moduleResource()
    .slug(typescriptSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('TypeScript', 'Adds TypeScript and its configuration')
    .dependsOn('init')
    .tags('setup')
    .factory((properties) => modules.buildModule(properties));
};
