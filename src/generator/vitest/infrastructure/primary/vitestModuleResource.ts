import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { VitestApplicationService } from '../../application/VitestApplicationService.js';

export const vitestSlug = 'vitest';

export const createVitestModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new VitestApplicationService(versions);

  return moduleResource()
    .slug(vitestSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Tests', 'Adds Vitest')
    .dependsOn('typescript')
    .tags('test')
    .factory((properties) => modules.buildModule(properties));
};
