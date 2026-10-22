import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { OpenapiApplicationService } from '../../application/OpenapiApplicationService.js';

export const openapiSlug = 'openapi';

export const createOpenapiModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new OpenapiApplicationService(versions);

  return moduleResource()
    .slug(openapiSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('API', 'Adds an OpenAPI document and a Swagger UI to the Fastify server')
    .dependsOn('fastify-server')
    .tags('api', 'openapi')
    .factory((properties) => modules.buildModule(properties));
};
