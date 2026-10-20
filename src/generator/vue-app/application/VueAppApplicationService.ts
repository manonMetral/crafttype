import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { VueAppFactory } from '../domain/VueAppFactory.js';

export class VueAppApplicationService {
  private readonly factory: VueAppFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new VueAppFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
