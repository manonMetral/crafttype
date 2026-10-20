import { describe, expect, it } from 'vitest';
import { from, moduleBuilder } from './CraftModule.js';
import { DuplicateDestinationError } from './errors.js';
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
});
