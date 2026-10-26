import { describe, expect, it } from 'vitest';
import { FileSystemNodePackagesVersionsReader } from '../../../shared/module/infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { resourcesRoot } from '../../../shared/module/infrastructure/secondary/resourcesRoot.js';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { EslintFactory } from './EslintFactory.js';

describe('EslintFactory', () => {
  const versions = new FileSystemNodePackagesVersionsReader(resourcesRoot());
  const factory = new EslintFactory(versions);

  it('adds an ESLint flat config, scripts and dependencies from the catalog', () => {
    const common = versions.get();
    const result = assertThatModule(factory.buildModule(propertiesFixture())).hasFileContaining(
      'eslint.config.js',
      '@babel/eslint-parser',
      "files: ['**/*.ts']",
    );

    const { devDependencies, scripts } = result.hasPackageJson();
    expect(devDependencies).toEqual({
      eslint: common.get('eslint'),
      '@eslint/js': common.get('@eslint/js'),
      '@babel/eslint-parser': common.get('@babel/eslint-parser'),
      '@babel/preset-typescript': common.get('@babel/preset-typescript'),
    });
    expect(scripts).toMatchObject({
      lint: 'eslint . --ext .ts,.js,.mjs,.cjs',
      'lint:fix': 'eslint . --ext .ts,.js,.mjs,.cjs --fix',
    });
  });
});
