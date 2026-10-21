import { describe, expect, it } from 'vitest';
import { from, moduleBuilder } from './CraftModule.js';
import { DuplicateDestinationError, NeedleError } from './errors.js';
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

    it('rejects the same destination declared twice', () => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');

      expect(() => builder.addFile(from('demo').file('other.txt'), 'src/a.txt')).toThrow(DuplicateDestinationError);
    });

    it('also rejects the same source copied twice to the same place', () => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'a.txt');

      expect(() => builder.addFile(from('demo').file('a.txt'), 'a.txt')).toThrow(DuplicateDestinationError);
    });

    it.each(['./src/a.txt', 'src//a.txt', 'src/x/../a.txt'])(
      'recognizes %j as the same destination as src/a.txt',
      (variant) => {
        const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');

        expect(() => builder.addFile(from('demo').file('b.txt'), variant)).toThrow(DuplicateDestinationError);
      },
    );

    it('names the duplicated destination in the message', () => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');

      expect(() => builder.addFile(from('demo').file('b.txt'), './src/a.txt')).toThrow(
        'The module declares the file src/a.txt twice',
      );
    });
  });
  describe('insertAtNeedle', () => {
    it('records the insertions in order, with a normalized path', () => {
      const module = moduleBuilder(properties)
        .insertAtNeedle('./src/main.ts', 'imports', 'import a from "a";')
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

    it('refuses to modify a file the same module creates', () => {
      const created = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');
      expect(() => created.insertAtNeedle('src/a.txt', 'x', 'y')).toThrow(DuplicateDestinationError);

      const edited = moduleBuilder(properties).insertAtNeedle('src/a.txt', 'x', 'y');
      expect(() => edited.addFile(from('demo').file('a.txt'), './src/a.txt')).toThrow(DuplicateDestinationError);
    });
  });
});
