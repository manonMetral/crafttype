import type { ModuleResource } from '../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../shared/module/domain/PackageVersions.js';
import { createConfigModuleResource } from './config/infrastructure/primary/configModuleResource.js';
import { createFastifyServerModuleResource } from './fastify-server/infrastructure/primary/fastifyServerModuleResource.js';
import { createInitModuleResource } from './init/infrastructure/primary/initModuleResource.js';
import { createLogsModuleResource } from './logs/infrastructure/primary/logsModuleResource.js';
import { createPiniaModuleResource } from './pinia/infrastructure/primary/piniaModuleResource.js';
import { createPrettierModuleResource } from './prettier/infrastructure/primary/prettierModuleResource.js';
import { createTypescriptModuleResource } from './typescript/infrastructure/primary/typescriptModuleResource.js';
import { createVitestModuleResource } from './vitest/infrastructure/primary/vitestModuleResource.js';
import { createVueRouterModuleResource } from './vue-router/infrastructure/primary/vueRouterModuleResource.js';
import { createVueAppModuleResource } from './vue-app/infrastructure/primary/vueAppModuleResource.js';

/** Catalogue des modules : ajouter une ligne ici pour exposer un nouveau module. */
export const allModuleResources = (versions: NodePackagesVersionsReader): readonly ModuleResource[] => [
  createInitModuleResource(),
  createTypescriptModuleResource(versions),
  createVitestModuleResource(versions),
  createPrettierModuleResource(versions),
  createFastifyServerModuleResource(versions),
  createConfigModuleResource(),
  createLogsModuleResource(),
  createVueAppModuleResource(versions),
  createPiniaModuleResource(versions),
  createVueRouterModuleResource(versions),
];
