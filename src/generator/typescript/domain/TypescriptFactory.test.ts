import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { TypescriptFactory } from './TypescriptFactory.js';

describe('TypescriptFactory', () => {
  const factory = new TypescriptFactory(new FileSystemNodePackagesVersionsReader(resourcesRoot()));

  it('adds the TypeScript configuration, the dependencies and the typecheck script', () => {
    const result = assertThatModule(factory.buildModule(propertiesFixture())).hasFileContaining(
      'tsconfig.json',
      '"strict": true',
    );

    expect(result.hasPackageJson().devDependencies).toHaveProperty('typescript');
    expect(result.hasPackageJson().devDependencies).toHaveProperty('@types/node');
    expect(result.hasPackageJson().scripts).toHaveProperty('typecheck', 'tsc --noEmit');
  });
});
