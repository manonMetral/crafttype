import { describe, expect, it } from 'vitest';
import { assertThatModule, propertiesFixture } from '../../../shared/test/ModuleAssertions.js';
import { InitFactory } from './InitFactory.js';

describe('InitFactory', () => {
  const factory = new InitFactory();

  it('crée les fichiers de base et le package.json', () => {
    const module = factory.buildModule(propertiesFixture({ projectName: 'shop' }));

    const result = assertThatModule(module)
      .hasFiles('.gitignore', '.editorconfig')
      .hasFileContaining('README.md', '# shop');

    expect(result.hasPackageJson()).toMatchObject({ name: 'shop', type: 'module', private: true });
  });
});
