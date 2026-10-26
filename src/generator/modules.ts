import type { ModuleResource } from '../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../shared/module/domain/PackageVersions.js';
import { createAuthModuleResource } from './auth/infrastructure/primary/authModuleResource.js';
import { createConfigModuleResource } from './config/infrastructure/primary/configModuleResource.js';
import { createDockerModuleResource } from './docker/infrastructure/primary/dockerModuleResource.js';
import { createEslintModuleResource } from './eslint/infrastructure/primary/eslintModuleResource.js';
import { createFetchClientModuleResource } from './fetch-client/infrastructure/primary/fetchClientModuleResource.js';
import { createFastifyServerModuleResource } from './fastify-server/infrastructure/primary/fastifyServerModuleResource.js';
import { createGithubActionsModuleResource } from './github-actions/infrastructure/primary/githubActionsModuleResource.js';
import { createHexagonalBackModuleResource } from './hexagonal-back/infrastructure/primary/hexagonalBackModuleResource.js';
import { createInitModuleResource } from './init/infrastructure/primary/initModuleResource.js';
import { createLogsModuleResource } from './logs/infrastructure/primary/logsModuleResource.js';
import { createOpenapiModuleResource } from './openapi/infrastructure/primary/openapiModuleResource.js';
import { createPersistenceModuleResource } from './persistence/infrastructure/primary/persistenceModuleResource.js';
import { createPiniaModuleResource } from './pinia/infrastructure/primary/piniaModuleResource.js';
import { createPrettierModuleResource } from './prettier/infrastructure/primary/prettierModuleResource.js';
import { createTypescriptModuleResource } from './typescript/infrastructure/primary/typescriptModuleResource.js';
import { createVitestModuleResource } from './vitest/infrastructure/primary/vitestModuleResource.js';
import { createVueRouterModuleResource } from './vue-router/infrastructure/primary/vueRouterModuleResource.js';
import { createVueAppModuleResource } from './vue-app/infrastructure/primary/vueAppModuleResource.js';

/** Module catalog: add a line here to expose a new module. */
export const allModuleResources = (versions: NodePackagesVersionsReader): readonly ModuleResource[] => [
  createInitModuleResource(),
  createTypescriptModuleResource(versions),
  createVitestModuleResource(versions),
  createPrettierModuleResource(versions),
  createEslintModuleResource(versions),
  createFastifyServerModuleResource(versions),
  createAuthModuleResource(),
  createConfigModuleResource(),
  createLogsModuleResource(),
  createVueAppModuleResource(versions),
  createPiniaModuleResource(versions),
  createVueRouterModuleResource(versions),
  createGithubActionsModuleResource(),
  createDockerModuleResource(),
  createFetchClientModuleResource(),
  createOpenapiModuleResource(versions),
  createHexagonalBackModuleResource(versions),
  createPersistenceModuleResource(),
];
