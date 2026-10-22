import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('fetch-client');
const API = 'src/webapp/api';

export class FetchClientFactory {
  /** A typed client on top of the platform `fetch`, with its tests: no new dependency. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('http.ts'), `${API}/http.ts`)
      .addFile(SOURCE.file('health.ts'), `${API}/health.ts`)
      .addFile(SOURCE.file('http.test.ts'), `${API}/http.test.ts`)
      .addFile(SOURCE.file('health.test.ts'), `${API}/health.test.ts`)
      .build();
  }
}
