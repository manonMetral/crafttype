import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { FastifyServerFactory } from './FastifyServerFactory.js';

describe('FastifyServerFactory', () => {
  const factory = new FastifyServerFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('creates the server on the requested port', () => {
    const module = factory.buildModule(propertiesFixture({ serverPort: 4321 }));

    const result = assertThatModule(module)
      .hasFiles('src/server/app.ts', 'src/server/app.test.ts', 'tsconfig.build.json')
      .hasFileContaining('src/server/main.ts', 'port: 4321')
      // Contract with the modules that modify app.ts and main.ts (config, logs...): if a needle disappears, they fail.
      .hasFileContaining(
        'src/server/app.ts',
        'crafttype-needle-app-imports',
        'crafttype-needle-app-server-options',
        'crafttype-needle-app-plugins',
      )
      .hasFileContaining('src/server/main.ts', 'crafttype-needle-main-imports', 'crafttype-needle-main-settings');

    expect(result.hasPackageJson().dependencies).toHaveProperty('fastify');
    expect(result.hasPackageJson().scripts).toHaveProperty('server:dev');
  });
});
