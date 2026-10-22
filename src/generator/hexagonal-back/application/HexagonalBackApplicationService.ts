import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { HexagonalBackFactory } from '../domain/HexagonalBackFactory.js';

export class HexagonalBackApplicationService {
  private readonly factory: HexagonalBackFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new HexagonalBackFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
