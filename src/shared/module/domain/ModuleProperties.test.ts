import { describe, expect, it } from 'vitest';
import {
  InvalidPropertyDefinitionError,
  InvalidPropertyError,
  MissingPropertyError,
  PropertyAccessError,
} from './errors.js';
import { ModulePropertiesDefinition, moduleProperties, type PropertyDefinition } from './ModuleProperties.js';

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

    it('falls back to "app" when the folder has no name, such as the root', () => {
      expect(definition.resolve({ projectFolder: '/' }).string('projectName')).toBe('app');
      expect(definition.resolve({ projectFolder: '//' }).string('projectName')).toBe('app');
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

  describe('presets', () => {
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

    it('are the values already set in the project, else the default values', () => {
      expect(database.presets('app', { databaseName: 'shop', poolSize: 25 })).toEqual({
        databaseName: 'shop',
        poolSize: 25,
        migrations: true,
      });
    });

    it('leave out a mandatory property that has no value, and keep the others', () => {
      expect(database.presets('app')).toEqual({ poolSize: 10, migrations: true });
    });

    it('leave out a value that is no longer valid, and keep the others', () => {
      expect(database.presets('app', { databaseName: 'shop', poolSize: 0, migrations: false })).toEqual({
        databaseName: 'shop',
        migrations: false,
      });
    });

    it('leave out a value that has the wrong type, and keep the others', () => {
      expect(database.presets('app', { databaseName: 'shop', poolSize: 'many' })).toEqual({
        databaseName: 'shop',
        migrations: true,
      });
    });

    it('ignore what the module does not declare', () => {
      expect(database.presets('app', { databaseName: 'shop', serverPort: 4000 })).toEqual({
        databaseName: 'shop',
        poolSize: 10,
        migrations: true,
      });
    });

    it('are the same as the resolved values when everything resolves', () => {
      const known = { projectName: 'shop', serverPort: 4000 };

      expect(definition.presets('app', known)).toEqual(definition.resolve({ projectFolder: 'app' }, known).values);
    });

    it('have no value when the project folder is blank', () => {
      expect(definition.presets('  ', { projectName: 'shop' })).toEqual({});
    });

    it('do not hide an error that is not about a property', () => {
      const exploding = ModulePropertiesDefinition.builder()
        .addString('flavor', {
          description: 'Flavor',
          defaultValue: () => {
            throw new TypeError('bug in a default value');
          },
        })
        .build();

      expect(() => exploding.presets('app')).toThrow('bug in a default value');
    });

    it('cannot be modified, and do not modify what they receive', () => {
      const known = { databaseName: 'shop' };
      const snapshot = structuredClone(known);

      const presets = database.presets('app', known);

      expect(() => {
        (presets as Record<string, unknown>)['databaseName'] = 'other';
      }).toThrow(TypeError);
      expect(known).toEqual(snapshot);
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

describe('ModuleProperties immutability', () => {
  it('is not affected by a later change to the values it was built from', () => {
    const source: Record<string, string> = { projectName: 'demo' };
    const properties = moduleProperties('app', source);

    source['projectName'] = 'other';
    source['extra'] = 'x';

    expect(properties.string('projectName')).toBe('demo');
    expect(properties.values).toEqual({ projectName: 'demo' });
  });

  it('exposes values that cannot be modified', () => {
    const properties = moduleProperties('app', { projectName: 'demo' });

    expect(() => {
      (properties.values as Record<string, string>)['projectName'] = 'other';
    }).toThrow(TypeError);
  });

  it('is not affected by a later change to the definitions it was built from', () => {
    const port: PropertyDefinition = { key: 'port', type: 'number', mandatory: false, description: 'Port' };
    const host: PropertyDefinition = { key: 'host', type: 'string', mandatory: false, description: 'Host' };
    const source = [port];
    const definition = ModulePropertiesDefinition.create(source);

    source.push(host);

    expect(definition.properties.map(({ key }) => key)).toEqual(['port']);
    expect(() => (definition.properties as unknown[]).push({})).toThrow(TypeError);
  });

  it('leaves a builder unchanged when another definition is derived from it', () => {
    const base = ModulePropertiesDefinition.builder();
    const derived = base.addServerPort();

    expect(derived.build().custom.map(({ key }) => key)).toEqual(['serverPort']);
    expect(base.build().custom).toEqual([]);
  });

  it('resolves without modifying what it receives', () => {
    const definition = ModulePropertiesDefinition.builder().addServerPort().build();
    const raw = { projectFolder: 'app', serverPort: '4000' };
    const known = { serverPort: 5000 };
    const rawSnapshot = structuredClone(raw);
    const knownSnapshot = structuredClone(known);

    definition.resolve(raw, known);

    expect(raw).toEqual(rawSnapshot);
    expect(known).toEqual(knownSnapshot);
  });
});
