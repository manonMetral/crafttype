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

  it('crée la configuration et son test, copiés tels quels', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() })))
      .hasFileContaining('src/server/config.ts', 'PORT invalide', 'defaults: ServerConfig')
      .hasFileContaining('src/server/config.test.ts', 'refuse PORT=%s');
  });

  it('ne rend aucun template : les valeurs par défaut sont celles de main.ts', () => {
    expect(factory.buildModule(propertiesFixture()).files.every(({ rendered }) => !rendered)).toBe(true);
  });

  it('complète les valeurs par défaut de main.ts avec la configuration validée', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }))).hasFileContaining(
      'src/server/main.ts',
      "import { loadConfig } from './config.js';",
      'Object.assign(settings, loadConfig(settings));',
    );
  });
});
