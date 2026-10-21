import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('config');
const SERVER = 'src/server';

export class ConfigFactory {
  /** Remplace les valeurs lues à la main dans `main.ts` (repère `main-settings` posé par fastify-server) par une configuration validée. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.template('config.ts'), `${SERVER}/config.ts`)
      .addFile(SOURCE.template('config.test.ts'), `${SERVER}/config.test.ts`)
      .insertAtNeedle(`${SERVER}/main.ts`, 'main-imports', "import { loadConfig } from './config.js';")
      .insertAtNeedle(`${SERVER}/main.ts`, 'main-settings', 'Object.assign(settings, loadConfig());')
      .build();
  }
}
