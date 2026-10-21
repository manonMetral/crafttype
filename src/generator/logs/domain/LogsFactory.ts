import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('logs');
const SERVER = 'src/server';

export class LogsFactory {
  /** Configure le logger de `buildApp` par les repères `app-imports` et `app-server-options` posés par fastify-server. */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('logger.ts'), `${SERVER}/logger.ts`)
      .addFile(SOURCE.file('logger.test.ts'), `${SERVER}/logger.test.ts`)
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-imports', "import { loggerOptions } from './logger.js';")
      .insertAtNeedle(
        `${SERVER}/app.ts`,
        'app-server-options',
        ['if (options.logger !== false) {', '  serverOptions.logger = loggerOptions();', '}', "serverOptions.requestIdHeader = 'x-request-id';"].join('\n'),
      )
      .build();
  }
}
