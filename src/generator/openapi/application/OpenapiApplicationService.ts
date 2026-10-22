import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { OpenapiFactory } from '../domain/OpenapiFactory.js';

export class OpenapiApplicationService {
  private readonly factory: OpenapiFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new OpenapiFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
