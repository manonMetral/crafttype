import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { ConfigFactory } from './ConfigFactory.js';

describe('ConfigFactory', () => {
  const factory = new ConfigFactory();

  // What fastify-server has already created: only the needles matter to this module.
  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(
      join(projectFolder, 'src/server/main.ts'),
      '// crafttype-needle-main-imports\nconst settings = {};\n// crafttype-needle-main-settings\n',
    );
    return projectFolder;
  };

  it('creates the configuration and its test, copied as is', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() })))
      .hasFileContaining('src/server/config.ts', 'Invalid PORT', 'defaults: ServerConfig')
      .hasFileContaining('src/server/config.test.ts', 'rejects PORT=%s');
  });

  it('renders no template: the defaults are those of main.ts', () => {
    expect(factory.buildModule(propertiesFixture()).files.every(({ rendered }) => !rendered)).toBe(true);
  });

  it('completes the defaults of main.ts with the validated configuration', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }))).hasFileContaining(
      'src/server/main.ts',
      "import { loadConfig } from './config.js';",
      'Object.assign(settings, loadConfig(settings));',
    );
  });
});
