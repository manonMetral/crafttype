import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { VueAppFactory } from './VueAppFactory.js';

describe('VueAppFactory', () => {
  const factory = new VueAppFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('creates the Vue application and proxies /api to the server', () => {
    const module = factory.buildModule(propertiesFixture({ serverPort: 4321 }));

    const result = assertThatModule(module)
      .hasFiles('src/webapp/main.ts', 'src/webapp/env.d.ts')
      // Contract with the modules that modify main.ts (pinia...): if a needle disappears, they fail.
      .hasFileContaining('src/webapp/main.ts', 'crafttype-needle-main-imports', 'crafttype-needle-main-plugins')
      .hasFileContaining('vite.config.ts', 'http://127.0.0.1:4321')
      // App.vue is copied as is: its {{ }} must not be interpreted by mustache.
      .hasFileContaining('src/webapp/App.vue', '{{ status }}', 'crafttype-needle-app-template');

    expect(result.hasPackageJson().devDependencies).toHaveProperty('vite');
  });

  it('adds front-end typing: tsc on src/webapp, with the DOM library and without Node types', () => {
    const result = assertThatModule(factory.buildModule(propertiesFixture())).hasFileContaining(
      'tsconfig.webapp.json',
      '"include": ["src/webapp"]',
      '"DOM"',
      '"types": []',
      'vue-tsc',
    );

    expect(result.hasPackageJson().scripts).toMatchObject({
      'webapp:typecheck': 'tsc --noEmit -p tsconfig.webapp.json',
    });
  });
});
