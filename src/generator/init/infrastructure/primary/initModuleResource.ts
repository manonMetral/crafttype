import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { InitFactory } from '../../domain/InitFactory.js';

export const initSlug = 'init';

export const createInitModuleResource = (): ModuleResource => {
  const factory = new InitFactory();

  return moduleResource()
    .slug(initSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addProjectName().build())
    .apiDoc('Init', 'Initialise le projet (package.json, .gitignore, README)')
    .standalone()
    .tags('setup')
    .factory((properties) => factory.buildModule(properties));
};
