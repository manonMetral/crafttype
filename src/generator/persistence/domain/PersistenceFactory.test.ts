import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { PersistenceFactory } from './PersistenceFactory.js';

describe('PersistenceFactory', () => {
  const factory = new PersistenceFactory();

  it('adds a base repository and two adapters with tests', () => {
    const module = factory.buildModule(propertiesFixture());
    assertThatModule(module)
      .hasFiles(
        'src/server/persistence/Repository.ts',
        'src/server/persistence/InMemoryRepository.ts',
        'src/server/persistence/JsonFileRepository.ts',
        'src/server/persistence/InMemoryRepository.test.ts',
        'src/server/persistence/JsonFileRepository.test.ts',
      )
      .hasFileContaining('src/server/persistence/Repository.ts', 'RepositoryEntity', 'findById')
      .hasFileContaining('src/server/persistence/JsonFileRepository.ts', 'node:fs/promises', 'readFile')
      .hasFileContaining('src/server/persistence/InMemoryRepository.ts', 'Map<string, T>');

    expect(module.packageJson).toEqual({ fields: {}, dependencies: {}, devDependencies: {}, scripts: {} });
  });
});
