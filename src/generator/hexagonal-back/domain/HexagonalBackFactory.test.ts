import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { HexagonalBackFactory } from './HexagonalBackFactory.js';

describe('HexagonalBackFactory', () => {
  const factory = new HexagonalBackFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  // What fastify-server has already created: only the needles matter to this module.
  const projectWithServer = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/server'), { recursive: true });
    writeFileSync(
      join(projectFolder, 'src/server/app.ts'),
      '// crafttype-needle-app-imports\nexport const app = () => {\n  // crafttype-needle-app-plugins\n  // crafttype-needle-app-routes\n};\n',
    );
    return projectFolder;
  };

  const built = () => factory.buildModule(propertiesFixture({ projectFolder: projectWithServer() }));

  it('lays out the greeting context in its four layers, with the tests', () => {
    const destinations = built().files.map(({ destination }) => destination);

    expect(destinations).toEqual(
      expect.arrayContaining([
        'src/server/greeting/domain/Greeting.ts',
        'src/server/greeting/domain/GreetingCounter.ts',
        'src/server/greeting/application/GreetingApplicationService.ts',
        'src/server/greeting/infrastructure/primary/greetingRoutes.ts',
        'src/server/greeting/infrastructure/secondary/InMemoryGreetingCounter.ts',
        'src/server/greeting/domain/Greeting.test.ts',
        'src/server/greeting/application/GreetingApplicationService.test.ts',
        'src/server/greeting/infrastructure/primary/greetingRoutes.test.ts',
        'src/server/greeting/infrastructure/secondary/InMemoryGreetingCounter.test.ts',
      ]),
    );
  });

  it('adds the composition root, the architecture test and its documentation', () => {
    assertThatModule(built())
      .hasFileContaining('src/server/composition.ts', 'registerContexts', 'app.register(greetingRoutes')
      .hasFileContaining('src/server/architecture.test.ts', 'src.server.', 'no node: module')
      .hasFileContaining('src/server/ARCHITECTURE.md', 'Architecture of `src/server`', '/api/health');
  });

  it('registers the route through the needles of app.ts, and adds arch-unit-ts', () => {
    const module = built();

    expect(module.edits).toEqual([
      {
        path: 'src/server/app.ts',
        needle: 'app-imports',
        content: "import { registerContexts } from './composition.js';",
      },
      { path: 'src/server/app.ts', needle: 'app-routes', content: 'registerContexts(app);' },
    ]);
    expect(module.packageJson.devDependencies).toHaveProperty('arch-unit-ts');
  });

  it('declares the route inside a Fastify plugin, never on the root instance', () => {
    assertThatModule(built()).hasFileContaining(
      'src/server/greeting/infrastructure/primary/greetingRoutes.ts',
      'FastifyPluginAsync',
      'async (app) =>',
    );
  });

  it('renders no template', () => {
    expect(built().files.every(({ rendered }) => !rendered)).toBe(true);
  });
});
