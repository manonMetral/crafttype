import { MissingPropertyError } from './errors.js';

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

const DEFAULT_SERVER_PORT = 3000;

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

  /** Applique les valeurs par défaut et refuse les propriétés obligatoires absentes. */
  resolve(raw: RawProperties): ModuleProperties {
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
      projectName: String(raw.projectName ?? lastSegment(projectFolder)),
      serverPort: Number(raw.serverPort ?? DEFAULT_SERVER_PORT),
    };
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

const lastSegment = (folder: string): string => folder.split(/[\\/]/).filter(Boolean).at(-1) ?? 'app';
