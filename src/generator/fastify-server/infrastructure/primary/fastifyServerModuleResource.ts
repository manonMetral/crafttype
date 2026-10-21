import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { FastifyServerApplicationService } from '../../application/FastifyServerApplicationService.js';

export const fastifyServerSlug = 'fastify-server';

export const createFastifyServerModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new FastifyServerApplicationService(versions);

  return moduleResource()
    .slug(fastifyServerSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addServerPort().build())
    .apiDoc('Server', 'Adds a Fastify server with a health endpoint')
    .dependsOn('typescript', 'vitest')
    .tags('server')
    .factory((properties) => modules.buildModule(properties));
};
