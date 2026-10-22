import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { DockerApplicationService } from '../../application/DockerApplicationService.js';

export const dockerSlug = 'docker';

export const createDockerModuleResource = (): ModuleResource => {
  const modules = new DockerApplicationService();

  return moduleResource()
    .slug(dockerSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addServerPort().build())
    .apiDoc('Deployment', 'Adds a multi-stage Dockerfile for the Fastify server')
    .dependsOn('fastify-server', 'config')
    .tags('docker', 'deployment')
    .factory((properties) => modules.buildModule(properties));
};
