import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { LogsFactory } from './LogsFactory.js';

describe('LogsFactory', () => {
  const factory = new LogsFactory();

  // What fastify-server has already created: only the needles matter to this module.
  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(
      join(projectFolder, 'src/server/app.ts'),
      '// crafttype-needle-app-imports\n// crafttype-needle-app-server-options\n// crafttype-needle-app-plugins\n',
    );
    return projectFolder;
  };

  it('creates the logger and its test, copied as is', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() })))
      .hasFileContaining('src/server/logger.ts', 'Invalid LOG_LEVEL')
      .hasFileContaining('src/server/logger.test.ts', 'x-request-id');
  });

  it('adds no dependency: the logger is the one from Fastify', () => {
    const { dependencies, devDependencies } = factory.buildModule(propertiesFixture()).packageJson;

    expect({ ...dependencies, ...devDependencies }).toEqual({});
  });

  it('configures the logger and the request id in buildApp', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }))).hasFileContaining(
      'src/server/app.ts',
      "import { echoRequestId, genReqId, loggerOptions } from './logger.js';",
      'if (options.logger !== false) {\n  serverOptions.logger = loggerOptions();\n}\nserverOptions.genReqId = genReqId;',
      'echoRequestId(app);',
    );
  });
});
