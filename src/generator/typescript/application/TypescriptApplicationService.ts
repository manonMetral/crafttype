import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { TypescriptFactory } from '../domain/TypescriptFactory.js';

export class TypescriptApplicationService {
  private readonly factory: TypescriptFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new TypescriptFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
