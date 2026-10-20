import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { PrettierFactory } from '../domain/PrettierFactory.js';

export class PrettierApplicationService {
  private readonly factory: PrettierFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new PrettierFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
