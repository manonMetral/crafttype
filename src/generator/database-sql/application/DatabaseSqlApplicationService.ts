import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import type { CraftModule } from '../../../shared/module/domain/CraftModule.js';
import { DatabaseSqlFactory } from '../domain/DatabaseSqlFactory.js';

export class DatabaseSqlApplicationService {
  private readonly factory: DatabaseSqlFactory;

  constructor(versions: NodePackagesVersionsReader) {
    this.factory = new DatabaseSqlFactory(versions);
  }

  buildModule(properties: ModuleProperties): CraftModule {
    return this.factory.buildModule(properties);
  }
}
