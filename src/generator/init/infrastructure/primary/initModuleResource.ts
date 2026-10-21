import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { InitApplicationService } from '../../application/InitApplicationService.js';

export const initSlug = 'init';

export const createInitModuleResource = (): ModuleResource => {
  const modules = new InitApplicationService();

  return moduleResource()
    .slug(initSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addProjectName().build())
    .apiDoc('Init', 'Initializes the project (package.json, .gitignore, README)')
    .standalone()
    .tags('setup')
    .factory((properties) => modules.buildModule(properties));
};
