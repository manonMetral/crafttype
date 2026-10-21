import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { ConfigApplicationService } from '../../application/ConfigApplicationService.js';

export const configSlug = 'config';

export const createConfigModuleResource = (): ModuleResource => {
  const modules = new ConfigApplicationService();

  return moduleResource()
    .slug(configSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Server', 'Adds server configuration from the environment, validated (PORT, HOST)')
    .dependsOn('fastify-server')
    .tags('server', 'config')
    .factory((properties) => modules.buildModule(properties));
};
