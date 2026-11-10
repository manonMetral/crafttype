import { describe, expect, it } from 'vitest';
import { from, moduleBuilder } from './CraftModule.js';
import { NeedleError } from './errors.js';
import { ModulePropertiesDefinition, moduleProperties } from './ModuleProperties.js';
import { PackageVersions } from './PackageVersions.js';

describe('CraftModuleBuilder', () => {
  const properties = ModulePropertiesDefinition.builder().build().resolve({ projectFolder: 'app' });

  describe('addFile', () => {
    it('accepts different destinations', () => {
      const module = moduleBuilder(properties)
        .addFile(from('demo').file('a.txt'), 'a.txt')
        .addFile(from('demo').template('b.txt'), 'src/b.txt')
        .build();

      expect(module.files.map((file) => file.destination)).toEqual(['a.txt', 'src/b.txt']);
    });
  });

  describe('insertAtNeedle', () => {
    it('records the insertions in the order they are declared', () => {
      const module = moduleBuilder(properties)
        .insertAtNeedle('src/main.ts', 'imports', 'import a from "a";')
        .insertAtNeedle('src/main.ts', 'plugins', 'use(a);')
        .build();

      expect(module.edits).toEqual([
        { path: 'src/main.ts', needle: 'imports', content: 'import a from "a";' },
        { path: 'src/main.ts', needle: 'plugins', content: 'use(a);' },
      ]);
    });

    it('rejects an invalid needle name', () => {
      expect(() => moduleBuilder(properties).insertAtNeedle('src/main.ts', 'Main_Imports', 'x')).toThrow(NeedleError);
    });
  });
});

describe('CraftModuleBuilder immutability', () => {
  const properties = ModulePropertiesDefinition.builder().build().resolve({ projectFolder: 'app' });
  const versions = new PackageVersions({ fastify: '5.12.7', vitest: '4.0.0' });

  it('builds a module that a later call on the builder does not change', () => {
    const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'a.txt');
    const first = builder.build();

    builder
      .addFile(from('demo').file('b.txt'), 'b.txt')
      .insertAtNeedle('src/main.ts', 'imports', 'x')
      .addDependency('fastify', versions)
      .addDevDependency('vitest', versions)
      .addScript('test', 'vitest run')
      .setPackageJsonField('type', 'module');

    expect(first.files).toHaveLength(1);
    expect(first.edits).toEqual([]);
    expect(first.packageJson).toEqual({ fields: {}, dependencies: {}, devDependencies: {}, scripts: {} });
  });

  it('keeps a value given to setPackageJsonField apart from the caller and from the built module', () => {
    const engines = { node: '>=22' };
    const builder = moduleBuilder(properties).setPackageJsonField('engines', engines);

    engines.node = '>=1';
    const first = builder.build();
    (first.packageJson.fields['engines'] as { node: string }).node = '>=2';
    const second = builder.build();

    expect(second.packageJson.fields['engines']).toEqual({ node: '>=22' });
  });

  it('does not let the context of the module change the properties it comes from', () => {
    const named = moduleProperties('app', { projectName: 'demo' });
    const module = moduleBuilder(named).build();

    (module.context as Record<string, string>)['projectName'] = 'other';

    expect(named.values['projectName']).toBe('demo');
  });
});
