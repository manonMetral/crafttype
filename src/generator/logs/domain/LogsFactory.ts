import type { ModuleProperties } from '../../../shared/module/domain/ModuleProperties.js';
import { from, moduleBuilder, type CraftModule } from '../../../shared/module/domain/CraftModule.js';

const SOURCE = from('logs');
const SERVER = 'src/server';

export class LogsFactory {
  /**
   * Configures the logger and the request id of `buildApp` through the `app-imports`,
   * `app-server-options-parts` and `app-plugins` needles of fastify-server. The options are composed from parts, never
   * modified once built.
   */
  buildModule(properties: ModuleProperties): CraftModule {
    return moduleBuilder(properties)
      .addFile(SOURCE.file('logger.ts'), `${SERVER}/logger.ts`)
      .addFile(SOURCE.file('logger.test.ts'), `${SERVER}/logger.test.ts`)
      .insertAtNeedle(
        `${SERVER}/app.ts`,
        'app-imports',
        "import { echoRequestId, genReqId, loggerOptions } from './logger.js';",
      )
      .insertAtNeedle(
        `${SERVER}/app.ts`,
        'app-server-options-parts',
        ['options.logger === false ? {} : { logger: loggerOptions() },', '{ genReqId },'].join('\n'),
      )
      .insertAtNeedle(`${SERVER}/app.ts`, 'app-plugins', 'echoRequestId(app);')
      .build();
  }
}
