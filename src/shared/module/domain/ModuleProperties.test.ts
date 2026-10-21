import { describe, expect, it } from 'vitest';
import {
  InvalidPropertyDefinitionError,
  InvalidPropertyError,
  MissingPropertyError,
  PropertyAccessError,
} from './errors.js';
import { ModulePropertiesDefinition, moduleProperties } from './ModuleProperties.js';

describe('ModulePropertiesDefinition', () => {
  const definition = ModulePropertiesDefinition.builder().addProjectName().addServerPort().build();

  describe('serverPort', () => {
    it('vaut 3000 par défaut et accepte une chaîne numérique', () => {
      expect(definition.resolve({ projectFolder: 'app' }).number('serverPort')).toBe(3000);
      expect(definition.resolve({ projectFolder: 'app', serverPort: '4000' }).number('serverPort')).toBe(4000);
    });

    it.each(['abc', ' 0 ', '-1', '3.5', '1e3', '0x50', '65536', '99999'])('refuse %j', (serverPort) => {
      expect(() => definition.resolve({ projectFolder: 'app', serverPort })).toThrow(InvalidPropertyError);
    });

    it('accepte les bornes 1 et 65535', () => {
      expect(definition.resolve({ projectFolder: 'app', serverPort: 1 }).number('serverPort')).toBe(1);
      expect(definition.resolve({ projectFolder: 'app', serverPort: 65_535 }).number('serverPort')).toBe(65_535);
    });
  });

  describe('projectName', () => {
    it('dérive un nom de paquet npm valide du dossier', () => {
      expect(definition.resolve({ projectFolder: '/tmp/Mon App' }).string('projectName')).toBe('mon-app');
      expect(definition.resolve({ projectFolder: 'C:\\travaux\\Été 2026\\' }).string('projectName')).toBe('ete-2026');
      expect(definition.resolve({ projectFolder: '/tmp/@@@' }).string('projectName')).toBe('app');
    });

    it('accepte un nom explicite valide, avec ou sans scope', () => {
      expect(definition.resolve({ projectFolder: 'x', projectName: 'shop.front_1' }).string('projectName')).toBe(
        'shop.front_1',
      );
      expect(definition.resolve({ projectFolder: 'x', projectName: '@equipe/shop' }).string('projectName')).toBe(
        '@equipe/shop',
      );
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

      expect(definition.resolve({ projectFolder: 'app' }, known).values).toEqual({
        projectName: 'shop',
        serverPort: 4000,
      });
      expect(definition.resolve({ projectFolder: 'app', serverPort: 5000 }, known).values).toEqual({
        projectName: 'shop',
        serverPort: 5000,
      });
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
    const properties = moduleProperties('/x', { projectName: 'shop', serverPort: 4000 });

    expect(definition.portable(properties)).toEqual({ projectName: 'shop', serverPort: 4000 });
    expect(ModulePropertiesDefinition.builder().addServerPort().build().portable(properties)).toEqual({
      serverPort: 4000,
    });
    expect(ModulePropertiesDefinition.builder().build().portable(properties)).toEqual({});
  });
  describe('propriétés propres à un module', () => {
    const database = ModulePropertiesDefinition.builder()
      .addString('databaseName', { description: 'Nom de la base', mandatory: true })
      .addNumber('poolSize', {
        description: 'Taille du pool',
        defaultValue: 10,
        validate: (size) => (Number(size) >= 1 ? undefined : 'au moins 1'),
      })
      .addBoolean('migrations', { description: 'Active les migrations', defaultValue: true })
      .addString('schema', { description: 'Schéma, sans valeur par défaut' })
      .build();

    it('résout chaque propriété avec son type', () => {
      const properties = database.resolve({
        projectFolder: 'app',
        databaseName: 'shop',
        poolSize: '25',
        migrations: 'false',
      });

      expect(properties.string('databaseName')).toBe('shop');
      expect(properties.number('poolSize')).toBe(25);
      expect(properties.boolean('migrations')).toBe(false);
    });

    it('applique les valeurs par défaut et laisse absentes les propriétés optionnelles sans défaut', () => {
      const properties = database.resolve({ projectFolder: 'app', databaseName: 'shop' });

      expect(properties.number('poolSize')).toBe(10);
      expect(properties.boolean('migrations')).toBe(true);
      expect(properties.values).not.toHaveProperty('schema');
      expect(() => properties.string('schema')).toThrow(PropertyAccessError);
    });

    it('calcule une valeur par défaut à partir du dossier du projet', () => {
      const named = ModulePropertiesDefinition.builder()
        .addString('label', { description: 'Libellé', defaultValue: ({ projectFolder }) => `projet:${projectFolder}` })
        .build();

      expect(named.resolve({ projectFolder: 'app' }).string('label')).toBe('projet:app');
    });

    it('exige une propriété obligatoire, sauf si un module précédent l’a déjà posée', () => {
      expect(() => database.resolve({ projectFolder: 'app' })).toThrow(MissingPropertyError);
      expect(database.resolve({ projectFolder: 'app' }, { databaseName: 'shop' }).string('databaseName')).toBe('shop');
    });

    it.each([
      ['poolSize', 'beaucoup'],
      ['poolSize', '0'],
      ['migrations', 'peut-être'],
    ])('refuse %s = %j', (key, value) => {
      expect(() => database.resolve({ projectFolder: 'app', databaseName: 'shop', [key]: value })).toThrow(
        InvalidPropertyError,
      );
    });

    it('accepte des valeurs déjà typées', () => {
      const properties = database.resolve({
        projectFolder: 'app',
        databaseName: 'shop',
        poolSize: 5,
        migrations: false,
      });

      expect(properties.values).toEqual({ databaseName: 'shop', poolSize: 5, migrations: false });
    });

    it('les rend portables dans l’historique', () => {
      const properties = database.resolve({ projectFolder: 'app', databaseName: 'shop' });

      expect(database.portable(properties)).toEqual({ databaseName: 'shop', poolSize: 10, migrations: true });
    });

    it('refuse de lire une propriété avec le mauvais type', () => {
      const properties = database.resolve({ projectFolder: 'app', databaseName: 'shop' });

      expect(() => properties.number('databaseName')).toThrow(PropertyAccessError);
    });
  });

  describe('définition d’une propriété', () => {
    it.each(['projectFolder', 'force', 'skipConflicts', 'dryRun', 'help'])('refuse la clé réservée %s', (key) => {
      expect(() => ModulePropertiesDefinition.builder().addString(key, { description: 'x' })).toThrow(
        InvalidPropertyDefinitionError,
      );
    });

    it.each(['Database', 'database_name', '1pool', 'database-name', ''])(
      'refuse la clé %j, illisible comme option',
      (key) => {
        expect(() => ModulePropertiesDefinition.builder().addString(key, { description: 'x' })).toThrow(
          InvalidPropertyDefinitionError,
        );
      },
    );

    it('refuse une clé déclarée deux fois', () => {
      expect(() =>
        ModulePropertiesDefinition.builder()
          .addString('label', { description: 'x' })
          .addNumber('label', { description: 'y' }),
      ).toThrow(InvalidPropertyDefinitionError);
    });
  });
});
