import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { PrettierApplicationService } from '../../application/PrettierApplicationService.js';

export const prettierSlug = 'prettier';

export const createPrettierModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new PrettierApplicationService(versions);

  return moduleResource()
    .slug(prettierSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Quality', 'Adds Prettier')
    .dependsOn('init')
    .tags('format')
    .factory((properties) => modules.buildModule(properties));
};
