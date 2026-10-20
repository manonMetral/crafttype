import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { InitApplicationService } from '../../application/InitApplicationService.js';

export const initSlug = 'init';

export const createInitModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new InitApplicationService(versions);

  return moduleResource()
    .slug(initSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addProjectName().build())
    .apiDoc('Init', 'Initialise le projet (package.json, .gitignore, README)')
    .standalone()
    .tags('setup')
    .factory((properties) => modules.buildModule(properties));
};
