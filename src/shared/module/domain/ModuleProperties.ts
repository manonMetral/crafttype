import {
  InvalidPropertyDefinitionError,
  InvalidPropertyError,
  MissingPropertyError,
  PropertyAccessError,
} from './errors.js';

export type PropertyType = 'string' | 'number' | 'boolean';
export type PropertyValue = string | number | boolean;

export interface PropertyDefinition {
  /** In camelCase: the command line option is derived from the key (`databaseName` -> `--database-name`). */
  readonly key: string;
  readonly type: PropertyType;
  readonly mandatory: boolean;
  readonly description: string;
  /** Fixed value, or computed from the project folder. */
  readonly defaultValue?: PropertyValue | ((context: { readonly projectFolder: string }) => PropertyValue);
  /** Receives the value already converted to the right type; returns the reason for rejection, or `undefined` if it is fine. */
  readonly validate?: (value: PropertyValue) => string | undefined;
}

/** Values entered by the user, before conversion: the command line only produces strings and booleans. */
export type RawProperties = Readonly<Record<string, PropertyValue | undefined>>;

/** Properties already set in the project by previously applied modules (see the history). */
export type KnownProperties = Readonly<Record<string, PropertyValue>>;

/** Resolved properties, passed to the module factories. Only the properties the module declares are readable. */
export interface ModuleProperties {
  readonly projectFolder: string;
  readonly values: KnownProperties;
  string(key: string): string;
  number(key: string): number;
  boolean(key: string): boolean;
}

export const moduleProperties = (projectFolder: string, values: KnownProperties = {}): ModuleProperties => {
  const read = <T extends PropertyValue>(key: string, type: PropertyType): T => {
    const value = values[key];
    if (value === undefined) {
      throw new PropertyAccessError(
        key,
        'the module does not declare it, or it has no value (neither mandatory nor a default value)',
      );
    }
    if (typeof value !== type) {
      throw new PropertyAccessError(key, `read as ${type} but its value is ${JSON.stringify(value)}`);
    }
    return value as T;
  };

  return {
    projectFolder,
    values,
    string: (key) => read<string>(key, 'string'),
    number: (key) => read<number>(key, 'number'),
    boolean: (key) => read<boolean>(key, 'boolean'),
  };
};

const PROJECT_FOLDER = 'projectFolder';
/** Keys used by the core or by the options of the `apply` command: a module cannot declare them. */
const RESERVED_KEYS: readonly string[] = [PROJECT_FOLDER, 'force', 'skipConflicts', 'dryRun', 'help'];
const KEY_FORMAT = /^[a-z][A-Za-z0-9]*$/;

const DEFAULT_SERVER_PORT = 3000;
const MAX_PORT = 65_535;
const MAX_PROJECT_NAME_LENGTH = 214;
// npm package name: lowercase letters, digits, `-`, `_`, `.`, optionally preceded by a scope (`@team/name`).
const NPM_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

const PROJECT_FOLDER_DEFINITION: PropertyDefinition = {
  key: PROJECT_FOLDER,
  type: 'string',
  mandatory: true,
  description: 'Folder of the project to generate or extend',
};

/** Describes the properties a module asks for (equivalent of Seed4JModulePropertiesDefinition). */
export class ModulePropertiesDefinition {
  private constructor(readonly properties: readonly PropertyDefinition[]) {}

  static builder(): ModulePropertiesDefinitionBuilder {
    return new ModulePropertiesDefinitionBuilder([PROJECT_FOLDER_DEFINITION]);
  }

  static create(properties: readonly PropertyDefinition[]): ModulePropertiesDefinition {
    return new ModulePropertiesDefinition(properties);
  }

  /** The module's own properties, without the project folder that every definition carries. */
  get custom(): readonly PropertyDefinition[] {
    return this.properties.filter(({ key }) => key !== PROJECT_FOLDER);
  }

  /**
   * Resolves the properties of a module. Priority: explicit value, then value already set in the project
   * by a previous module (`known`), then default value. Rejects missing or invalid properties, and
   * properties the module does not declare.
   */
  resolve(raw: RawProperties, known: KnownProperties = {}): ModuleProperties {
    const declared = new Set<string>(this.properties.map(({ key }) => key));
    for (const [key, value] of Object.entries(raw)) {
      if (key !== PROJECT_FOLDER && !isBlank(value) && !declared.has(key)) {
        throw new InvalidPropertyError(key, 'not supported by this module');
      }
    }

    const projectFolder = String(raw[PROJECT_FOLDER] ?? '');
    if (projectFolder.trim() === '') {
      throw new MissingPropertyError(PROJECT_FOLDER);
    }

    const values: Record<string, PropertyValue> = {};
    for (const definition of this.custom) {
      const value = resolveValue(definition, given(raw[definition.key]) ?? known[definition.key], projectFolder);
      if (value !== undefined) {
        values[definition.key] = value;
      }
    }
    return moduleProperties(projectFolder, values);
  }

  /** The properties this module declares, to record in the project history. */
  portable(properties: ModuleProperties): KnownProperties {
    const declared = new Set<string>(this.custom.map(({ key }) => key));
    return Object.fromEntries(Object.entries(properties.values).filter(([key]) => declared.has(key)));
  }
}

export interface PropertyOptions {
  readonly description: string;
  readonly mandatory?: boolean;
  readonly defaultValue?: PropertyDefinition['defaultValue'];
  readonly validate?: PropertyDefinition['validate'];
}

export class ModulePropertiesDefinitionBuilder {
  constructor(private readonly properties: readonly PropertyDefinition[]) {}

  addString(key: string, options: PropertyOptions): ModulePropertiesDefinitionBuilder {
    return this.addProperty(key, 'string', options);
  }

  addNumber(key: string, options: PropertyOptions): ModulePropertiesDefinitionBuilder {
    return this.addProperty(key, 'number', options);
  }

  addBoolean(key: string, options: PropertyOptions): ModulePropertiesDefinitionBuilder {
    return this.addProperty(key, 'boolean', options);
  }

  addProjectName(): ModulePropertiesDefinitionBuilder {
    return this.addString('projectName', {
      description: 'Project name (default: folder name)',
      defaultValue: ({ projectFolder }) => slugify(lastSegment(projectFolder)),
      validate: (name) =>
        String(name).length > MAX_PROJECT_NAME_LENGTH || !NPM_PACKAGE_NAME.test(String(name))
          ? `"${name}" is not a valid npm package name (lowercase letters, digits, -, _ and . only; no space or uppercase)`
          : undefined,
    });
  }

  addServerPort(): ModulePropertiesDefinitionBuilder {
    return this.addNumber('serverPort', {
      description: 'HTTP port of the server',
      defaultValue: DEFAULT_SERVER_PORT,
      validate: (port) =>
        Number.isInteger(port) && Number(port) >= 1 && Number(port) <= MAX_PORT
          ? undefined
          : `"${port}" is not a valid port (integer from 1 to ${MAX_PORT})`,
    });
  }

  build(): ModulePropertiesDefinition {
    return ModulePropertiesDefinition.create(this.properties);
  }

  private addProperty(key: string, type: PropertyType, options: PropertyOptions): ModulePropertiesDefinitionBuilder {
    if (RESERVED_KEYS.includes(key)) {
      throw new InvalidPropertyDefinitionError(key, 'key reserved by the core or by the options of the apply command');
    }
    if (!KEY_FORMAT.test(key)) {
      throw new InvalidPropertyDefinitionError(
        key,
        'the key must be in camelCase (letters and digits, starting with a lowercase letter)',
      );
    }
    if (this.properties.some((definition) => definition.key === key)) {
      throw new InvalidPropertyDefinitionError(key, 'declared twice');
    }
    const { description, mandatory = false, defaultValue, validate } = options;
    const definition: PropertyDefinition = {
      key,
      type,
      mandatory,
      description,
      ...(defaultValue === undefined ? {} : { defaultValue }),
      ...(validate === undefined ? {} : { validate }),
    };
    return new ModulePropertiesDefinitionBuilder([...this.properties, definition]);
  }
}

const isBlank = (value: PropertyValue | undefined): boolean => value === undefined || String(value).trim() === '';

const given = (value: PropertyValue | undefined): PropertyValue | undefined => (isBlank(value) ? undefined : value);

const resolveValue = (
  definition: PropertyDefinition,
  candidate: PropertyValue | undefined,
  projectFolder: string,
): PropertyValue | undefined => {
  const { key, defaultValue } = definition;
  const chosen = candidate ?? (typeof defaultValue === 'function' ? defaultValue({ projectFolder }) : defaultValue);

  if (chosen === undefined) {
    if (definition.mandatory) {
      throw new MissingPropertyError(key);
    }
    return undefined;
  }

  const value = convert(key, definition.type, chosen);
  const reason = definition.validate?.(value);
  if (reason !== undefined) {
    throw new InvalidPropertyError(key, reason);
  }
  return value;
};

const DECIMAL = /^-?\d+(?:\.\d+)?$/;

const convert = (key: string, type: PropertyType, value: PropertyValue): PropertyValue => {
  const text = String(value).trim();
  switch (type) {
    case 'string':
      return text;
    case 'number':
      if (typeof value === 'number' ? !Number.isFinite(value) : !DECIMAL.test(text)) {
        throw new InvalidPropertyError(key, `"${text}" is not a number`);
      }
      return Number(text);
    case 'boolean':
      if (text !== 'true' && text !== 'false') {
        throw new InvalidPropertyError(key, `"${text}" is not a boolean (true or false)`);
      }
      return text === 'true';
  }
};

const lastSegment = (folder: string): string => folder.split(/[\\/]/).filter(Boolean).at(-1) ?? '';

/** Default name taken from the folder: "Mon App" becomes "mon-app". */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, MAX_PROJECT_NAME_LENGTH) || 'app';
