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
    it('defaults to 3000 and accepts a numeric string', () => {
      expect(definition.resolve({ projectFolder: 'app' }).number('serverPort')).toBe(3000);
      expect(definition.resolve({ projectFolder: 'app', serverPort: '4000' }).number('serverPort')).toBe(4000);
    });

    it.each(['abc', ' 0 ', '-1', '3.5', '1e3', '0x50', '65536', '99999'])('rejects %j', (serverPort) => {
      expect(() => definition.resolve({ projectFolder: 'app', serverPort })).toThrow(InvalidPropertyError);
    });

    it('accepts the bounds 1 and 65535', () => {
      expect(definition.resolve({ projectFolder: 'app', serverPort: 1 }).number('serverPort')).toBe(1);
      expect(definition.resolve({ projectFolder: 'app', serverPort: 65_535 }).number('serverPort')).toBe(65_535);
    });
  });

  describe('projectName', () => {
    it('derives a valid npm package name from the folder', () => {
      expect(definition.resolve({ projectFolder: '/tmp/My App' }).string('projectName')).toBe('my-app');
      expect(definition.resolve({ projectFolder: 'C:\\work\\Été 2026\\' }).string('projectName')).toBe('ete-2026');
      expect(definition.resolve({ projectFolder: '/tmp/@@@' }).string('projectName')).toBe('app');
    });

    it('accepts a valid explicit name, with or without a scope', () => {
      expect(definition.resolve({ projectFolder: 'x', projectName: 'shop.front_1' }).string('projectName')).toBe(
        'shop.front_1',
      );
      expect(definition.resolve({ projectFolder: 'x', projectName: '@team/shop' }).string('projectName')).toBe(
        '@team/shop',
      );
    });

    it.each(['My App', 'shop front', 'Shop', '.cache', '_x', '</title><script>alert(1)</script>', 'a'.repeat(215)])(
      'rejects the explicit name %j',
      (projectName) => {
        expect(() => definition.resolve({ projectFolder: 'x', projectName })).toThrow(InvalidPropertyError);
      },
    );
  });

  describe('properties already set in the project', () => {
    it('take precedence over default values, but not over explicit values', () => {
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

    it('are validated like the others', () => {
      expect(() => definition.resolve({ projectFolder: 'app' }, { serverPort: 70_000 })).toThrow(InvalidPropertyError);
    });
  });

  it('rejects a property the module does not declare', () => {
    const withoutOptions = ModulePropertiesDefinition.builder().build();

    expect(() => withoutOptions.resolve({ projectFolder: 'app', serverPort: 4000 })).toThrow(InvalidPropertyError);
    expect(() => withoutOptions.resolve({ projectFolder: 'app', projectName: 'shop' })).toThrow(InvalidPropertyError);
  });

  it('requires the project folder', () => {
    expect(() => definition.resolve({})).toThrow(MissingPropertyError);
    expect(() => definition.resolve({ projectFolder: '  ' })).toThrow(MissingPropertyError);
  });

  it('only makes the declared properties portable, without the folder', () => {
    const properties = moduleProperties('/x', { projectName: 'shop', serverPort: 4000 });

    expect(definition.portable(properties)).toEqual({ projectName: 'shop', serverPort: 4000 });
    expect(ModulePropertiesDefinition.builder().addServerPort().build().portable(properties)).toEqual({
      serverPort: 4000,
    });
    expect(ModulePropertiesDefinition.builder().build().portable(properties)).toEqual({});
  });
  describe('module-specific properties', () => {
    const database = ModulePropertiesDefinition.builder()
      .addString('databaseName', { description: 'Database name', mandatory: true })
      .addNumber('poolSize', {
        description: 'Pool size',
        defaultValue: 10,
        validate: (size) => (Number(size) >= 1 ? undefined : 'at least 1'),
      })
      .addBoolean('migrations', { description: 'Enables migrations', defaultValue: true })
      .addString('schema', { description: 'Schema, without a default value' })
      .build();

    it('resolves each property with its type', () => {
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

    it('applies default values and leaves optional properties without a default absent', () => {
      const properties = database.resolve({ projectFolder: 'app', databaseName: 'shop' });

      expect(properties.number('poolSize')).toBe(10);
      expect(properties.boolean('migrations')).toBe(true);
      expect(properties.values).not.toHaveProperty('schema');
      expect(() => properties.string('schema')).toThrow(PropertyAccessError);
    });

    it('computes a default value from the project folder', () => {
      const named = ModulePropertiesDefinition.builder()
        .addString('label', { description: 'Label', defaultValue: ({ projectFolder }) => `project:${projectFolder}` })
        .build();

      expect(named.resolve({ projectFolder: 'app' }).string('label')).toBe('project:app');
    });

    it('requires a mandatory property, unless a previous module already set it', () => {
      expect(() => database.resolve({ projectFolder: 'app' })).toThrow(MissingPropertyError);
      expect(database.resolve({ projectFolder: 'app' }, { databaseName: 'shop' }).string('databaseName')).toBe('shop');
    });

    it.each([
      ['poolSize', 'many'],
      ['poolSize', '0'],
      ['migrations', 'maybe'],
    ])('rejects %s = %j', (key, value) => {
      expect(() => database.resolve({ projectFolder: 'app', databaseName: 'shop', [key]: value })).toThrow(
        InvalidPropertyError,
      );
    });

    it('accepts values that are already typed', () => {
      const properties = database.resolve({
        projectFolder: 'app',
        databaseName: 'shop',
        poolSize: 5,
        migrations: false,
      });

      expect(properties.values).toEqual({ databaseName: 'shop', poolSize: 5, migrations: false });
    });

    it('makes them portable in the history', () => {
      const properties = database.resolve({ projectFolder: 'app', databaseName: 'shop' });

      expect(database.portable(properties)).toEqual({ databaseName: 'shop', poolSize: 10, migrations: true });
    });

    it('refuses to read a property with the wrong type', () => {
      const properties = database.resolve({ projectFolder: 'app', databaseName: 'shop' });

      expect(() => properties.number('databaseName')).toThrow(PropertyAccessError);
    });
  });

  describe('property definition', () => {
    it.each(['projectFolder', 'force', 'skipConflicts', 'dryRun', 'help'])('rejects the reserved key %s', (key) => {
      expect(() => ModulePropertiesDefinition.builder().addString(key, { description: 'x' })).toThrow(
        InvalidPropertyDefinitionError,
      );
    });

    it.each(['Database', 'database_name', '1pool', 'database-name', ''])(
      'rejects the key %j, unusable as an option',
      (key) => {
        expect(() => ModulePropertiesDefinition.builder().addString(key, { description: 'x' })).toThrow(
          InvalidPropertyDefinitionError,
        );
      },
    );

    it('rejects a key declared twice', () => {
      expect(() =>
        ModulePropertiesDefinition.builder()
          .addString('label', { description: 'x' })
          .addNumber('label', { description: 'y' }),
      ).toThrow(InvalidPropertyDefinitionError);
    });
  });
});
