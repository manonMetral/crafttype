import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('logs');
const SERVER = 'src/server';

export class LogsFactory {
  /** Configure le logger et l'identifiant de requête de `buildApp` par les repères `app-imports`, `app-server-options` et `app-plugins` de fastify-server. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('logger.ts'), `${SERVER}/logger.ts`)
      .addFile(SOURCE.file('logger.test.ts'), `${SERVER}/logger.test.ts`)
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-imports', "import { echoRequestId, genReqId, loggerOptions } from './logger.js';")
      .insertAtNeedle(
        `${SERVER}/app.ts`,
        'app-server-options',
        ['if (options.logger !== false) {', '  serverOptions.logger = loggerOptions();', '}', 'serverOptions.genReqId = genReqId;'].join('\n'),
      )
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-plugins', 'echoRequestId(app);')
      .build();
  }
}
