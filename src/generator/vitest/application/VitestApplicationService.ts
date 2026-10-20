import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { VitestFactory } from '../domain/VitestFactory.js';

export class VitestApplicationService {
  private readonly factory: VitestFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new VitestFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
