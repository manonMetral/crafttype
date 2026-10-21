import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { PiniaFactory } from '../domain/PiniaFactory.js';

export class PiniaApplicationService {
  private readonly factory: PiniaFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new PiniaFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
