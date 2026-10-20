import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { VueAppFactory } from './VueAppFactory.js';

describe('VueAppFactory', () => {
  const factory = new VueAppFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('crée l’application Vue et proxifie /api vers le serveur', () => {
    const module = factory.buildModule(propertiesFixture({ serverPort: 4321 }));

    const result = assertThatModule(module)
      .hasFiles('src/webapp/main.ts', 'src/webapp/env.d.ts')
      .hasFileContaining('vite.config.ts', 'http://127.0.0.1:4321')
      // App.vue est copié tel quel : ses {{ }} ne doivent pas être interprétés par mustache.
      .hasFileContaining('src/webapp/App.vue', '{{ status }}');

    expect(result.hasPackageJson().devDependencies).toHaveProperty('vite');
  });
});
