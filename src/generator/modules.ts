import type { ModuleResource } from '../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../shared/module/domain/PackageVersions.js';
import { createFastifyServerModuleResource } from './fastify-server/infrastructure/primary/fastifyServerModuleResource.js';
import { createInitModuleResource } from './init/infrastructure/primary/initModuleResource.js';
import { createTypescriptModuleResource } from './typescript/infrastructure/primary/typescriptModuleResource.js';
import { createVitestModuleResource } from './vitest/infrastructure/primary/vitestModuleResource.js';
import { createVueAppModuleResource } from './vue-app/infrastructure/primary/vueAppModuleResource.js';

/** Catalogue des modules : ajouter une ligne ici pour exposer un nouveau module. */
export const allModuleResources = (versions: NodePackagesVersionsReader): readonly ModuleResource[] => [
  createInitModuleResource(versions),
  createTypescriptModuleResource(versions),
  createVitestModuleResource(versions),
  createFastifyServerModuleResource(versions),
  createVueAppModuleResource(versions),
];
