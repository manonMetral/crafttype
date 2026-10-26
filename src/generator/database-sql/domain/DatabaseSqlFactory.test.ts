import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { DatabaseSqlFactory } from './DatabaseSqlFactory.js';

describe('DatabaseSqlFactory', () => {
  const versions = new FileSystemNodePackagesVersionsReader(resourcesRoot());
  const factory = new DatabaseSqlFactory(versions);

  it('adds a SQL client and an example repository under src/server/database', () => {
    const module = factory.buildModule(propertiesFixture());
    assertThatModule(module)
      .hasFiles(
        'src/server/database/sqlClient.ts',
        'src/server/database/sqlClient.test.ts',
        'src/server/database/users/User.ts',
        'src/server/database/users/SqlUserRepository.ts',
        'src/server/database/users/SqlUserRepository.test.ts',
      )
      .hasFileContaining('src/server/database/sqlClient.ts', 'createPostgresSqlClient', 'sqlConfigFromEnv')
      .hasFileContaining(
        'src/server/database/users/SqlUserRepository.ts',
        'implements Repository<User>',
        'CREATE TABLE IF NOT EXISTS users',
      );
  });

  it('adds pg with the exact version from the shared catalog', () => {
    const common = versions.get();
    const { dependencies, devDependencies } = factory.buildModule(propertiesFixture()).packageJson;
    expect(dependencies).toEqual({
      pg: common.get('pg'),
    });
    expect(devDependencies).toEqual({
      '@types/pg': common.get('@types/pg'),
    });
  });
});
