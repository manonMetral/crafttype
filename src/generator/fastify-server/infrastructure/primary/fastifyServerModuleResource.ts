import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { FastifyServerFactory } from '../../domain/FastifyServerFactory.js';

export const fastifyServerSlug = 'fastify-server';

export const createFastifyServerModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const factory = new FastifyServerFactory(versions);

  return moduleResource()
    .slug(fastifyServerSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().addServerPort().build())
    .apiDoc('Serveur', 'Ajoute un serveur Fastify avec un endpoint de santé')
    .dependsOn('typescript', 'vitest')
    .tags('server')
    .factory((properties) => factory.buildModule(properties));
};
