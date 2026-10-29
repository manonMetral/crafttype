import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import type { NodePackagesVersionsReader } from '../../../shared/module/domain/PackageVersions.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('database-sql');
const DATABASE = 'src/server/database';

export class DatabaseSqlFactory {
  constructor(private readonly versions: NodePackagesVersionsReader) {}

  /** PostgreSQL SQL client utilities and an example repository based on the persistence contract. */
  buildModule(properties: ModuleProperties): CraftModule {
    const common = this.versions.get();

    return moduleBuilder(properties)
      .addFile(SOURCE.file('sqlClient.ts'), `${DATABASE}/sqlClient.ts`)
      .addFile(SOURCE.file('sqlClient.test.ts'), `${DATABASE}/sqlClient.test.ts`)
      .addFile(SOURCE.file('users/User.ts'), `${DATABASE}/users/User.ts`)
      .addFile(SOURCE.file('users/SqlUserRepository.ts'), `${DATABASE}/users/SqlUserRepository.ts`)
      .addFile(SOURCE.file('users/SqlUserRepository.test.ts'), `${DATABASE}/users/SqlUserRepository.test.ts`)
      .addDependency('pg', common)
      .addDevDependency('@types/pg', common)
      .build();
  }
}
