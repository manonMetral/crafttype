import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { PiniaFactory } from './PiniaFactory.js';

describe('PiniaFactory', () => {
  const factory = new PiniaFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('ajoute la dépendance et branche Pinia dans le main.ts de l’application Vue', () => {
    const module = factory.buildModule(propertiesFixture());

    expect(module.packageJson.dependencies).toHaveProperty('pinia');
    expect(module.files).toEqual([]);
    expect(module.edits).toEqual([
      { path: 'src/webapp/main.ts', needle: 'main-imports', content: "import { createPinia } from 'pinia';" },
      { path: 'src/webapp/main.ts', needle: 'main-plugins', content: 'app.use(createPinia());' },
    ]);
  });
});
