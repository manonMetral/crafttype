import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { PrettierFactory } from './PrettierFactory.js';

describe('PrettierFactory', () => {
  const factory = new PrettierFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('ajoute la configuration Prettier, la dépendance et les scripts de formatage', () => {
    const result = assertThatModule(factory.buildModule(propertiesFixture())).hasFileContaining('.prettierrc.json', '"singleQuote": true');

    expect(result.hasPackageJson().devDependencies).toHaveProperty('prettier');
    expect(result.hasPackageJson().scripts).toMatchObject({ format: 'prettier --write .', 'format:check': 'prettier --check .' });
  });
});
