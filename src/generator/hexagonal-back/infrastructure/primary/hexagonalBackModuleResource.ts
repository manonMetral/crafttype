import { ModulePropertiesDefinition } from '../../../../shared/module/domain/ModuleProperties.js';
import { moduleResource, type ModuleResource } from '../../../../shared/module/domain/ModuleResource.js';
import type { NodePackagesVersionsReader } from '../../../../shared/module/domain/PackageVersions.js';
import { HexagonalBackApplicationService } from '../../application/HexagonalBackApplicationService.js';

export const hexagonalBackSlug = 'hexagonal-back';

export const createHexagonalBackModuleResource = (versions: NodePackagesVersionsReader): ModuleResource => {
  const modules = new HexagonalBackApplicationService(versions);

  return moduleResource()
    .slug(hexagonalBackSlug)
    .propertiesDefinition(ModulePropertiesDefinition.builder().build())
    .apiDoc('Architecture', 'Adds a hexagonal structure to the server, an example context and an architecture test')
    .dependsOn('fastify-server', 'vitest')
    .tags('backend', 'architecture')
    .factory((properties) => modules.buildModule(properties));
};
