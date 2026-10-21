import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture, tmpDirForTest } from '../../../shared/test/ModuleAssertions.js';
import { VueRouterFactory } from './VueRouterFactory.js';

describe('VueRouterFactory', () => {
  const factory = new VueRouterFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  // What vue-app has already created: only the needles matter to this module.
  const projectWithVueApp = (): string => {
    const projectFolder = tmpDirForTest();
    mkdirSync(join(projectFolder, 'src/webapp'), { recursive: true });
    writeFileSync(
      join(projectFolder, 'src/webapp/main.ts'),
      '// crafttype-needle-main-imports\n// crafttype-needle-main-plugins\n',
    );
    writeFileSync(
      join(projectFolder, 'src/webapp/App.vue'),
      '<template>\n  <main>\n    <!-- crafttype-needle-app-template -->\n  </main>\n</template>\n',
    );
    return projectFolder;
  };

  it('creates the router and its home page, copied as is', () => {
    const result = assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithVueApp() })))
      .hasFileContaining('src/webapp/router.ts', "from 'vue-router'", "path: '/'")
      .hasFileContaining('src/webapp/views/HomeView.vue', '<h2>Home</h2>');

    expect(result.hasPackageJson().dependencies).toHaveProperty('vue-router');
  });

  it('wires the router into main.ts and displays the current view in App.vue', () => {
    assertThatModule(factory.buildModule(propertiesFixture({ projectFolder: projectWithVueApp() })))
      .hasFileContaining('src/webapp/main.ts', "import { router } from './router.js';", 'app.use(router);')
      .hasFileContaining('src/webapp/App.vue', '    <RouterView />\n    <!-- crafttype-needle-app-template -->');
  });
});
