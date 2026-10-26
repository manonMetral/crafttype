import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { AuthFactory } from './AuthFactory.js';

describe('AuthFactory', () => {
  const factory = new AuthFactory();

  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(
      join(projectFolder, 'src/server/app.ts'),
      '// crafttype-needle-app-imports\n// crafttype-needle-app-routes\n',
    );
    return projectFolder;
  };

  it('adds JWT auth files and route registration in app.ts', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() })))
      .hasFiles(
        'src/server/auth/jwt.ts',
        'src/server/auth/jwt.test.ts',
        'src/server/auth/authentication.ts',
        'src/server/auth/authRoutes.ts',
        'src/server/auth/authRoutes.test.ts',
      )
      .hasFileContaining(
        'src/server/app.ts',
        "import { registerAuthRoutes } from './auth/authRoutes.js';",
        'registerAuthRoutes(app);',
      )
      .hasFileContaining('src/server/auth/authRoutes.ts', '/api/auth/token', '/api/auth/me', 'preHandler');
  });

  it('adds no dependency and no script', () => {
    expect(factory.buildModule(propertiesFixture()).packageJson).toEqual({
      fields: {},
      dependencies: {},
      devDependencies: {},
      scripts: {},
    });
  });
});
