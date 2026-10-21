import { describe, expect, it } from 'vitest';
import { from, moduleBuilder } from './CraftModule.js';
import { DuplicateDestinationError, NeedleError } from './errors.js';
import { ModulePropertiesDefinition } from './ModuleProperties.js';

describe('CraftModuleBuilder', () => {
  const properties = ModulePropertiesDefinition.builder().build().resolve({ projectFolder: 'app' });

  describe('addFile', () => {
    it('accepte des destinations différentes', () => {
      const module = moduleBuilder(properties)
        .addFile(from('demo').file('a.txt'), 'a.txt')
        .addFile(from('demo').template('b.txt'), 'src/b.txt')
        .build();

      expect(module.files.map((file) => file.destination)).toEqual(['a.txt', 'src/b.txt']);
    });

    it('refuse la même destination déclarée deux fois', () => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');

      expect(() => builder.addFile(from('demo').file('autre.txt'), 'src/a.txt')).toThrow(DuplicateDestinationError);
    });

    it('refuse aussi la même source copiée deux fois au même endroit', () => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'a.txt');

      expect(() => builder.addFile(from('demo').file('a.txt'), 'a.txt')).toThrow(DuplicateDestinationError);
    });

    it.each(['./src/a.txt', 'src//a.txt', 'src/x/../a.txt'])('reconnaît %j comme la même destination que src/a.txt', (variant) => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');

      expect(() => builder.addFile(from('demo').file('b.txt'), variant)).toThrow(DuplicateDestinationError);
    });

    it('nomme la destination en double dans le message', () => {
      const builder = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');

      expect(() => builder.addFile(from('demo').file('b.txt'), './src/a.txt')).toThrow('Le module déclare deux fois le fichier src/a.txt');
    });
  });
  describe('insertAtNeedle', () => {
    it('enregistre les insertions dans l’ordre, avec un chemin normalisé', () => {
      const module = moduleBuilder(properties)
        .insertAtNeedle('./src/main.ts', 'imports', 'import a from "a";')
        .insertAtNeedle('src/main.ts', 'plugins', 'use(a);')
        .build();

      expect(module.edits).toEqual([
        { path: 'src/main.ts', needle: 'imports', content: 'import a from "a";' },
        { path: 'src/main.ts', needle: 'plugins', content: 'use(a);' },
      ]);
    });

    it('refuse un nom de repère invalide', () => {
      expect(() => moduleBuilder(properties).insertAtNeedle('src/main.ts', 'Main_Imports', 'x')).toThrow(NeedleError);
    });

    it('refuse de modifier un fichier que le même module crée', () => {
      const created = moduleBuilder(properties).addFile(from('demo').file('a.txt'), 'src/a.txt');
      expect(() => created.insertAtNeedle('src/a.txt', 'x', 'y')).toThrow(DuplicateDestinationError);

      const edited = moduleBuilder(properties).insertAtNeedle('src/a.txt', 'x', 'y');
      expect(() => edited.addFile(from('demo').file('a.txt'), './src/a.txt')).toThrow(DuplicateDestinationError);
    });
  });
});
