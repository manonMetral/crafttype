import { describe, expect, it } from 'vitest';
import { from, moduleBuilder } from './CraftModule.js';
import { NeedleError } from './errors.js';
import { ModulePropertiesDefinition } from './ModuleProperties.js';

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
