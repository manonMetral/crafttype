import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import { AuthApplicationService } from '../../application/AuthApplicationService.js';

export const authSlug = 'auth';

export const createAuthModuleResource = (): ModuleResource => {
  const modules = new AuthApplicationService();

  return moduleResource()
    .slug(authSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Backend', 'Adds JWT auth routes and a bearer middleware to the Fastify server')
    .dependsOn('fastify-server', 'vitest')
    .tags('backend', 'security', 'auth')
    .factory((properties) => modules.buildModule(properties));
};
