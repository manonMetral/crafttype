import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { VueRouterFactory } from '../domain/VueRouterFactory.js';

export class VueRouterApplicationService {
  private readonly factory: VueRouterFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new VueRouterFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
