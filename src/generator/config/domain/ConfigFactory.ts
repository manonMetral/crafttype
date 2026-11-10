import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('config');
const SERVER = 'src/server';

export class ConfigFactory {
  /** Adds a step to `settingsSteps` (`main.ts` of fastify-server, needle `main-settings-steps`): it completes the defaults with the validated environment and returns new settings. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('config.ts'), `${SERVER}/config.ts`)
      .addFile(SOURCE.file('config.test.ts'), `${SERVER}/config.test.ts`)
      .insertAtNeedle(`${SERVER}/main.ts`, 'main-imports', "import { loadConfig } from './config.js';")
      .insertAtNeedle(`${SERVER}/main.ts`, 'main-settings-steps', 'loadConfig,')
      .build();
  }
}
