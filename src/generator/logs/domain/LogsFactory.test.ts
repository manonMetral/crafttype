import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { LogsFactory } from './LogsFactory.js';

describe('LogsFactory', () => {
  const factory = new LogsFactory();

  // Ce que fastify-server a déjà créé : seuls les repères comptent pour ce module.
  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(join(projectFolder, 'src/server/app.ts'), '// crafttype-needle-app-imports\n// crafttype-needle-app-server-options\n');
    return projectFolder;
  };

  it('crée le logger et son test, copiés tels quels', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() })))
      .hasFileContaining('src/server/logger.ts', 'LOG_LEVEL invalide')
      .hasFileContaining('src/server/logger.test.ts', 'x-request-id');
  });

  it('n’ajoute aucune dépendance : le logger est celui de Fastify', () => {
    const { dependencies, devDependencies } = factory.buildModule(propertiesFixture()).packageJson;

    expect({ ...dependencies, ...devDependencies }).toEqual({});
  });

  it('configure le logger et l’identifiant de requête dans buildApp', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }))).hasFileContaining(
      'src/server/app.ts',
      "import { loggerOptions } from './logger.js';",
      'if (options.logger !== false) {\n  serverOptions.logger = loggerOptions();\n}\nserverOptions.requestIdHeader',
    );
  });
});
