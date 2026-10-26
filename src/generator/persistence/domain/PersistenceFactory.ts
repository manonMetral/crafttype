import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('persistence');
const PERSISTENCE = 'src/server/persistence';

export class PersistenceFactory {
  /** Base repository abstraction and two adapters: in-memory and JSON file. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('Repository.ts'), `${PERSISTENCE}/Repository.ts`)
      .addFile(SOURCE.file('InMemoryRepository.ts'), `${PERSISTENCE}/InMemoryRepository.ts`)
      .addFile(SOURCE.file('JsonFileRepository.ts'), `${PERSISTENCE}/JsonFileRepository.ts`)
      .addFile(SOURCE.file('InMemoryRepository.test.ts'), `${PERSISTENCE}/InMemoryRepository.test.ts`)
      .addFile(SOURCE.file('JsonFileRepository.test.ts'), `${PERSISTENCE}/JsonFileRepository.test.ts`)
      .build();
  }
}
