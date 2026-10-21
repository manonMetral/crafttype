import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('config');
const SERVER = 'src/server';

export class ConfigFactory {
  /** Complète les valeurs par défaut de `settings` (`main.ts` de fastify-server, repère `main-settings`) avec l'environnement, validé. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('config.ts'), `${SERVER}/config.ts`)
      .addFile(SOURCE.file('config.test.ts'), `${SERVER}/config.test.ts`)
      .insertAtNeedle(`${SERVER}/main.ts`, 'main-imports', "import { loadConfig } from './config.js';")
      .insertAtNeedle(`${SERVER}/main.ts`, 'main-settings', 'Object.assign(settings, loadConfig(settings));')
      .build();
  }
}
