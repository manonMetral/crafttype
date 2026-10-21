import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { ConfigFactory } from './ConfigFactory.js';

describe('ConfigFactory', () => {
  const factory = new ConfigFactory();

  // Ce que fastify-server a déjà créé : seuls les repères comptent pour ce module.
  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(join(projectFolder, 'src/server/main.ts'), '// crafttype-needle-main-imports\nconst settings = {};\n// crafttype-needle-main-settings\n');
    return projectFolder;
  };

  it('crée la configuration et son test avec le port choisi', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer(), serverPort: 4321 })))
      .hasFileContaining('src/server/config.ts', 'return 4321;', 'PORT invalide')
      .hasFileContaining('src/server/config.test.ts', 'port: 4321', 'refuse PORT=%s');
  });

  it('remplace dans main.ts les valeurs lues à la main par la configuration validée', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }))).hasFileContaining(
      'src/server/main.ts',
      "import { loadConfig } from './config.js';",
      'Object.assign(settings, loadConfig());',
    );
  });
});
