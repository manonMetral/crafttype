import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { FastifyServerFactory } from '../domain/FastifyServerFactory.js';

export class FastifyServerApplicationService {
  private readonly factory: FastifyServerFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new FastifyServerFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
