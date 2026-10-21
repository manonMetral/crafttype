import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { VitestFactory } from './VitestFactory.js';

describe('VitestFactory', () => {
  const factory = new VitestFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('ajoute la configuration Vitest, la dépendance et les scripts de test', () => {
    const result = assertThatModule(factory.buildModule(propertiesFixture())).hasFileContaining(
      'vitest.config.ts',
      'src/**/*.test.ts',
    );

    expect(result.hasPackageJson().devDependencies).toHaveProperty('vitest');
    expect(result.hasPackageJson().scripts).toMatchObject({ test: 'vitest run', 'test:watch': 'vitest' });
  });
});
