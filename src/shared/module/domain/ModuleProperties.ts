import { InvalidPropertyDefinitionError, InvalidPropertyError, MissingPropertyError, PropertyAccessError } from './errors.js';

export type PropertyType = 'string' | 'number' | 'boolean';
export type PropertyValue = string | number | boolean;

export interface PropertyDefinition {
  /** En camelCase : l'option de la ligne de commande est dérivée de la clé (`databaseName` -> `--database-name`). */
  readonly key: string;
  readonly type: PropertyType;
  readonly mandatory: boolean;
  readonly description: string;
  /** Valeur fixe, ou calculée à partir du dossier du projet. */
  readonly defaultValue?: PropertyValue | ((context: { readonly projectFolder: string }) => PropertyValue);
  /** Reçoit la valeur déjà convertie au bon type ; renvoie le motif du refus, ou `undefined` si elle convient. */
  readonly validate?: (value: PropertyValue) => string | undefined;
}

/** Valeurs saisies par l'utilisateur, avant conversion : la ligne de commande ne produit que des chaînes et des booléens. */
export type RawProperties = Readonly<Record<string, PropertyValue | undefined>>;

/** Propriétés déjà posées dans le projet par des modules appliqués précédemment (voir l'historique). */
export type KnownProperties = Readonly<Record<string, PropertyValue>>;

/** Propriétés résolues, transmises aux fabriques de modules. Seules les propriétés déclarées par le module sont lisibles. */
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
      throw new PropertyAccessError(key, 'le module ne la déclare pas, ou elle n\'a pas de valeur (ni obligatoire, ni valeur par défaut)');
    }
    if (typeof value !== type) {
      throw new PropertyAccessError(key, `lue comme ${type} alors qu'elle vaut ${JSON.stringify(value)}`);
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
/** Clés prises par le noyau ou par les options de la commande `apply` : un module ne peut pas les déclarer. */
const RESERVED_KEYS: readonly string[] = [PROJECT_FOLDER, 'force', 'skipConflicts', 'dryRun', 'help'];
const KEY_FORMAT = /^[a-z][A-Za-z0-9]*$/;

const DEFAULT_SERVER_PORT = 3000;
const MAX_PORT = 65_535;
const MAX_PROJECT_NAME_LENGTH = 214;
// Nom de paquet npm : minuscules, chiffres, `-`, `_`, `.`, éventuellement précédé d'un scope (`@equipe/nom`).
const NPM_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

const PROJECT_FOLDER_DEFINITION: PropertyDefinition = {
  key: PROJECT_FOLDER,
  type: 'string',
  mandatory: true,
  description: 'Dossier du projet à générer ou à enrichir',
};

/** Décrit les propriétés demandées par un module (équivalent de Seed4JModulePropertiesDefinition). */
export class ModulePropertiesDefinition {
  private constructor(readonly properties: readonly PropertyDefinition[]) {}

  static builder(): ModulePropertiesDefinitionBuilder {
    return new ModulePropertiesDefinitionBuilder([PROJECT_FOLDER_DEFINITION]);
  }

  static create(properties: readonly PropertyDefinition[]): ModulePropertiesDefinition {
    return new ModulePropertiesDefinition(properties);
  }

  /** Les propriétés propres au module, sans le dossier du projet que toutes les définitions portent. */
  get custom(): readonly PropertyDefinition[] {
    return this.properties.filter(({ key }) => key !== PROJECT_FOLDER);
  }

  /**
   * Résout les propriétés d'un module. Priorité : valeur explicite, puis valeur déjà posée dans le projet
   * par un module précédent (`known`), puis valeur par défaut. Refuse les propriétés absentes, invalides
   * ou que le module ne déclare pas.
   */
  resolve(raw: RawProperties, known: KnownProperties = {}): ModuleProperties {
    const declared = new Set<string>(this.properties.map(({ key }) => key));
    for (const [key, value] of Object.entries(raw)) {
      if (key !== PROJECT_FOLDER && !isBlank(value) && !declared.has(key)) {
        throw new InvalidPropertyError(key, 'non pris en charge par ce module');
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

  /** Les propriétés que ce module déclare, à enregistrer dans l'historique du projet. */
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
      description: 'Nom du projet (par défaut : nom du dossier)',
      defaultValue: ({ projectFolder }) => slugify(lastSegment(projectFolder)),
      validate: (name) =>
        String(name).length > MAX_PROJECT_NAME_LENGTH || !NPM_PACKAGE_NAME.test(String(name))
          ? `« ${name} » n'est pas un nom de paquet npm valide (minuscules, chiffres, -, _ et . ; ni espace ni majuscule)`
          : undefined,
    });
  }

  addServerPort(): ModulePropertiesDefinitionBuilder {
    return this.addNumber('serverPort', {
      description: 'Port HTTP du serveur',
      defaultValue: DEFAULT_SERVER_PORT,
      validate: (port) =>
        Number.isInteger(port) && Number(port) >= 1 && Number(port) <= MAX_PORT
          ? undefined
          : `« ${port} » n'est pas un port valide (entier de 1 à ${MAX_PORT})`,
    });
  }

  build(): ModulePropertiesDefinition {
    return ModulePropertiesDefinition.create(this.properties);
  }

  private addProperty(key: string, type: PropertyType, options: PropertyOptions): ModulePropertiesDefinitionBuilder {
    if (RESERVED_KEYS.includes(key)) {
      throw new InvalidPropertyDefinitionError(key, 'clé réservée par le noyau ou par les options de la commande apply');
    }
    if (!KEY_FORMAT.test(key)) {
      throw new InvalidPropertyDefinitionError(key, 'la clé doit être en camelCase (lettres et chiffres, commençant par une minuscule)');
    }
    if (this.properties.some((definition) => definition.key === key)) {
      throw new InvalidPropertyDefinitionError(key, 'déclarée deux fois');
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

const resolveValue = (definition: PropertyDefinition, candidate: PropertyValue | undefined, projectFolder: string): PropertyValue | undefined => {
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
        throw new InvalidPropertyError(key, `« ${text} » n'est pas un nombre`);
      }
      return Number(text);
    case 'boolean':
      if (text !== 'true' && text !== 'false') {
        throw new InvalidPropertyError(key, `« ${text} » n'est pas un booléen (true ou false)`);
      }
      return text === 'true';
  }
};

const lastSegment = (folder: string): string => folder.split(/[\\/]/).filter(Boolean).at(-1) ?? '';

/** Nom par défaut tiré du dossier : « Mon App » devient « mon-app ». */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, MAX_PROJECT_NAME_LENGTH) || 'app';
