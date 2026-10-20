import { InvalidPropertyError, MissingPropertyError } from './errors.js';

export type PropertyType = 'string' | 'number';

export interface PropertyDefinition {
  readonly key: keyof ModuleProperties;
  readonly type: PropertyType;
  readonly mandatory: boolean;
  readonly description: string;
  readonly defaultValue?: string | number;
}

/** Propriétés résolues, toujours complètes, transmises aux fabriques de modules. */
export interface ModuleProperties {
  readonly projectFolder: string;
  readonly projectName: string;
  readonly serverPort: number;
}

export type RawProperties = Partial<Record<keyof ModuleProperties, string | number>>;

/** Propriétés déjà posées dans le projet par des modules appliqués précédemment (voir l'historique). */
export type KnownProperties = Partial<Omit<ModuleProperties, 'projectFolder'>>;

const DEFAULT_SERVER_PORT = 3000;
const MAX_PORT = 65_535;
const MAX_PROJECT_NAME_LENGTH = 214;
// Nom de paquet npm : minuscules, chiffres, `-`, `_`, `.`, éventuellement précédé d'un scope (`@equipe/nom`).
const NPM_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

/** Décrit les propriétés demandées par un module (équivalent de Seed4JModulePropertiesDefinition). */
export class ModulePropertiesDefinition {
  private constructor(readonly properties: readonly PropertyDefinition[]) {}

  static builder(): ModulePropertiesDefinitionBuilder {
    return new ModulePropertiesDefinitionBuilder([
      {
        key: 'projectFolder',
        type: 'string',
        mandatory: true,
        description: 'Dossier du projet à générer ou à enrichir',
      },
    ]);
  }

  static create(properties: readonly PropertyDefinition[]): ModulePropertiesDefinition {
    return new ModulePropertiesDefinition(properties);
  }

  /**
   * Résout les propriétés d'un module. Priorité : valeur explicite, puis valeur déjà posée dans le projet
   * par un module précédent (`known`), puis valeur par défaut. Refuse les propriétés absentes, invalides
   * ou que le module ne déclare pas.
   */
  resolve(raw: RawProperties, known: KnownProperties = {}): ModuleProperties {
    const declared = new Set<string>(this.properties.map(({ key }) => key));
    for (const [key, value] of Object.entries(raw)) {
      if (key !== 'projectFolder' && !isBlank(value) && !declared.has(key)) {
        throw new InvalidPropertyError(key, 'non pris en charge par ce module');
      }
    }

    for (const definition of this.properties) {
      if (definition.mandatory && isBlank(raw[definition.key])) {
        throw new MissingPropertyError(definition.key);
      }
    }

    const projectFolder = String(raw.projectFolder ?? '');
    if (projectFolder === '') {
      throw new MissingPropertyError('projectFolder');
    }

    return {
      projectFolder,
      projectName: resolveProjectName(given(raw.projectName), known.projectName, projectFolder),
      serverPort: resolveServerPort(given(raw.serverPort), known.serverPort),
    };
  }

  /** Les propriétés que ce module déclare, à enregistrer dans l'historique du projet. */
  portable(properties: ModuleProperties): KnownProperties {
    const { projectFolder: _, ...portable } = properties;
    const declared = new Set<string>(this.properties.map(({ key }) => key));
    return Object.fromEntries(Object.entries(portable).filter(([key]) => declared.has(key)));
  }
}

export class ModulePropertiesDefinitionBuilder {
  constructor(private readonly properties: readonly PropertyDefinition[]) {}

  addProjectName(): ModulePropertiesDefinitionBuilder {
    return this.add({
      key: 'projectName',
      type: 'string',
      mandatory: false,
      description: 'Nom du projet (par défaut : nom du dossier)',
    });
  }

  addServerPort(): ModulePropertiesDefinitionBuilder {
    return this.add({
      key: 'serverPort',
      type: 'number',
      mandatory: false,
      description: 'Port HTTP du serveur',
      defaultValue: DEFAULT_SERVER_PORT,
    });
  }

  build(): ModulePropertiesDefinition {
    return ModulePropertiesDefinition.create(this.properties);
  }

  private add(definition: PropertyDefinition): ModulePropertiesDefinitionBuilder {
    return new ModulePropertiesDefinitionBuilder([...this.properties, definition]);
  }
}

const isBlank = (value: string | number | undefined): boolean => value === undefined || String(value).trim() === '';

const given = (value: string | number | undefined): string | number | undefined => (isBlank(value) ? undefined : value);

const lastSegment = (folder: string): string => folder.split(/[\\/]/).filter(Boolean).at(-1) ?? '';

/** Nom par défaut tiré du dossier : « Mon App » devient « mon-app ». */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, MAX_PROJECT_NAME_LENGTH) || 'app';

const resolveProjectName = (explicit: string | number | undefined, known: string | undefined, projectFolder: string): string => {
  const name = explicit === undefined ? (known ?? slugify(lastSegment(projectFolder))) : String(explicit).trim();

  if (name.length > MAX_PROJECT_NAME_LENGTH || !NPM_PACKAGE_NAME.test(name)) {
    throw new InvalidPropertyError('projectName', `« ${name} » n'est pas un nom de paquet npm valide (minuscules, chiffres, -, _ et . ; ni espace ni majuscule)`);
  }
  return name;
};

const resolveServerPort = (explicit: string | number | undefined, known: number | undefined): number => {
  const text = String(explicit ?? known ?? DEFAULT_SERVER_PORT).trim();
  const port = /^\d+$/.test(text) ? Number(text) : Number.NaN;

  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new InvalidPropertyError('serverPort', `« ${text} » n'est pas un port valide (entier de 1 à ${MAX_PORT})`);
  }
  return port;
};
