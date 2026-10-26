import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { PersistenceApplicationService } from '../../application/PersistenceApplicationService.js';

export const persistenceSlug = 'persistence';

export const createPersistenceModuleResource = (): ModuleResource => {
  const modules = new PersistenceApplicationService();

  return moduleResource()
    .slug(persistenceSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Backend', 'Adds a base repository abstraction and persistence adapters')
    .dependsOn('fastify-server', 'vitest')
    .tags('backend', 'persistence')
    .factory((properties) => modules.buildModule(properties));
};
