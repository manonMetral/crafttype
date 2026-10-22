import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { OpenapiFactory } from './OpenapiFactory.js';

describe('OpenapiFactory', () => {
  const factory = new OpenapiFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  // What fastify-server has already created: only the needles matter to this module.
  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(
      join(projectFolder, 'src/server/app.ts'),
      '// crafttype-needle-app-imports\n// crafttype-needle-app-plugins\n',
    );
    return projectFolder;
  };

  it('creates the OpenAPI setup and its test, copied as is', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() })))
      .hasFileContaining('src/server/openapi.ts', 'Invalid OPENAPI_DOCS', "'/api/openapi.json'", "'/api/docs'")
      .hasFileContaining('src/server/openapi.test.ts', 'docsEnabled');
  });

  it('adds the two Fastify plugins, with the exact versions of the catalog', () => {
    const { dependencies, devDependencies } = factory.buildModule(propertiesFixture()).packageJson;

    expect(Object.keys(dependencies).sort()).toEqual(['@fastify/swagger', '@fastify/swagger-ui']);
    expect(dependencies['@fastify/swagger']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(dependencies['@fastify/swagger-ui']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(devDependencies).toEqual({});
  });

  it('registers the plugins in buildApp, through the needles above the routes', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }))).hasFileContaining(
      'src/server/app.ts',
      "import { registerOpenApi } from './openapi.js';",
      'registerOpenApi(app);',
    );
  });
});
