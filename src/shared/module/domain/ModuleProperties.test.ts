import { describe, expect, it } from 'vitest';
import { InvalidPropertyError, MissingPropertyError } from './errors.js';
import { ModulePropertiesDefinition } from './ModuleProperties.js';

describe('ModulePropertiesDefinition', () => {
  const definition = ModulePropertiesDefinition.builder().addProjectName().addServerPort().build();

  describe('serverPort', () => {
    it('vaut 3000 par défaut et accepte une chaîne numérique', () => {
      expect(definition.resolve({ projectFolder: 'app' }).serverPort).toBe(3000);
      expect(definition.resolve({ projectFolder: 'app', serverPort: '4000' }).serverPort).toBe(4000);
    });

    it.each(['abc', ' 0 ', '-1', '3.5', '1e3', '0x50', '65536', '99999'])('refuse %j', (serverPort) => {
      expect(() => definition.resolve({ projectFolder: 'app', serverPort })).toThrow(InvalidPropertyError);
    });

    it('accepte les bornes 1 et 65535', () => {
      expect(definition.resolve({ projectFolder: 'app', serverPort: 1 }).serverPort).toBe(1);
      expect(definition.resolve({ projectFolder: 'app', serverPort: 65_535 }).serverPort).toBe(65_535);
    });
  });

  describe('projectName', () => {
    it('dérive un nom de paquet npm valide du dossier', () => {
      expect(definition.resolve({ projectFolder: '/tmp/Mon App' }).projectName).toBe('mon-app');
      expect(definition.resolve({ projectFolder: 'C:\\travaux\\Été 2026\\' }).projectName).toBe('ete-2026');
      expect(definition.resolve({ projectFolder: '/tmp/@@@' }).projectName).toBe('app');
    });

    it('accepte un nom explicite valide, avec ou sans scope', () => {
      expect(definition.resolve({ projectFolder: 'x', projectName: 'shop.front_1' }).projectName).toBe('shop.front_1');
      expect(definition.resolve({ projectFolder: 'x', projectName: '@equipe/shop' }).projectName).toBe('@equipe/shop');
    });

    it.each(['Mon App', 'shop front', 'Shop', '.cache', '_x', '</title><script>alert(1)</script>', 'a'.repeat(215)])(
      'refuse le nom explicite %j',
      (projectName) => {
        expect(() => definition.resolve({ projectFolder: 'x', projectName })).toThrow(InvalidPropertyError);
      },
    );
  });

  describe('propriétés déjà posées dans le projet', () => {
    it('passent avant les valeurs par défaut, après les valeurs explicites', () => {
      const known = { projectName: 'shop', serverPort: 4000 };

      expect(definition.resolve({ projectFolder: 'app' }, known)).toMatchObject({ projectName: 'shop', serverPort: 4000 });
      expect(definition.resolve({ projectFolder: 'app', serverPort: 5000 }, known)).toMatchObject({ projectName: 'shop', serverPort: 5000 });
    });

    it('sont validées comme les autres', () => {
      expect(() => definition.resolve({ projectFolder: 'app' }, { serverPort: 70_000 })).toThrow(InvalidPropertyError);
    });
  });

  it('refuse une propriété que le module ne déclare pas', () => {
    const withoutOptions = ModulePropertiesDefinition.builder().build();

    expect(() => withoutOptions.resolve({ projectFolder: 'app', serverPort: 4000 })).toThrow(InvalidPropertyError);
    expect(() => withoutOptions.resolve({ projectFolder: 'app', projectName: 'shop' })).toThrow(InvalidPropertyError);
  });

  it('exige le dossier du projet', () => {
    expect(() => definition.resolve({})).toThrow(MissingPropertyError);
    expect(() => definition.resolve({ projectFolder: '  ' })).toThrow(MissingPropertyError);
  });

  it('ne rend portables que les propriétés déclarées, sans le dossier', () => {
    const properties = { projectFolder: '/x', projectName: 'shop', serverPort: 4000 };

    expect(definition.portable(properties)).toEqual({ projectName: 'shop', serverPort: 4000 });
    expect(ModulePropertiesDefinition.builder().addServerPort().build().portable(properties)).toEqual({ serverPort: 4000 });
    expect(ModulePropertiesDefinition.builder().build().portable(properties)).toEqual({});
  });
});
