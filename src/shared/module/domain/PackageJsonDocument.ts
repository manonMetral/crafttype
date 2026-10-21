import type { PackageJsonChanges } from './CraftModule.js';
import { isRecord, parseJsonObject } from './jsonFile.js';

export const PACKAGE_JSON_PATH = 'package.json';

/** Les quatre sortes d'entrées qu'un module peut poser dans le package.json. */
export type PackageJsonEntryKind = 'field' | 'script' | 'dependency' | 'devDependency';

/** Une entrée du package.json ; `value` est la valeur sérialisée en JSON. */
export interface PackageJsonEntry {
  readonly kind: PackageJsonEntryKind;
  readonly target: string;
  readonly value: string;
}

/**
 * Où vit chaque sorte d'entrée dans le package.json. C'est la seule table de correspondance : la lecture, l'écriture,
 * le tri et les libellés s'y réfèrent. `section` vaut `undefined` pour un champ de premier niveau (`name`, `type`...).
 */
const KINDS: Readonly<
  Record<
    PackageJsonEntryKind,
    {
      readonly section: string | undefined;
      readonly sorted: boolean;
      readonly wanted: (changes: PackageJsonChanges) => Readonly<Record<string, unknown>>;
    }
  >
> = {
  field: { section: undefined, sorted: false, wanted: (changes) => changes.fields },
  script: { section: 'scripts', sorted: false, wanted: (changes) => changes.scripts },
  dependency: { section: 'dependencies', sorted: true, wanted: (changes) => changes.dependencies },
  devDependency: { section: 'devDependencies', sorted: true, wanted: (changes) => changes.devDependencies },
};

/** Nom lisible d'une entrée : `package.json : scripts.test`. */
export const describePackageJsonEntry = (kind: PackageJsonEntryKind, target: string): string => {
  const { section } = KINDS[kind];
  return `${PACKAGE_JSON_PATH} : ${section === undefined ? '' : `${section}.`}${target}`;
};

/** Le package.json du projet généré : le lire, y poser des entrées, le réécrire sans perdre ce que l'équipe y a mis. */
export class PackageJsonDocument {
  private constructor(private readonly content: Readonly<Record<string, unknown>>) {}

  /** Un fichier absent est un document vide ; un fichier illisible ou qui n'est pas un objet est refusé. */
  static parse(raw: string | undefined): PackageJsonDocument {
    return new PackageJsonDocument(raw === undefined ? {} : parseJsonObject(PACKAGE_JSON_PATH, raw));
  }

  /** Les entrées que le module veut poser, dans l'ordre champs, scripts, dépendances, dépendances de développement. */
  static wantedBy(changes: PackageJsonChanges): readonly PackageJsonEntry[] {
    return (Object.keys(KINDS) as PackageJsonEntryKind[]).flatMap((kind) =>
      Object.entries(KINDS[kind].wanted(changes)).map(([target, value]) => ({
        kind,
        target,
        value: JSON.stringify(value),
      })),
    );
  }

  /** Valeur actuelle de l'entrée, sérialisée en JSON, ou `undefined` si elle n'existe pas. */
  entry(kind: PackageJsonEntryKind, target: string): string | undefined {
    const value = this.container(kind)[target];
    return value === undefined ? undefined : JSON.stringify(value);
  }

  /**
   * Un nouveau document avec ces entrées posées. Le reste est conservé tel quel ; seules les listes de dépendances
   * touchées sont triées.
   */
  with(entries: readonly PackageJsonEntry[]): PackageJsonDocument {
    const content: Record<string, unknown> = { ...this.content };
    const touched = new Set<string>();

    for (const { kind, target, value } of entries) {
      const { section, sorted } = KINDS[kind];
      if (section === undefined) {
        content[target] = JSON.parse(value);
        continue;
      }
      content[section] = { ...asRecord(content[section]), [target]: JSON.parse(value) };
      if (sorted) touched.add(section);
    }

    for (const section of touched) {
      content[section] = sortKeys(asRecord(content[section]));
    }
    return new PackageJsonDocument(content);
  }

  serialize(): string {
    return `${JSON.stringify(this.content, null, 2)}\n`;
  }

  private container(kind: PackageJsonEntryKind): Readonly<Record<string, unknown>> {
    const { section } = KINDS[kind];
    return section === undefined ? this.content : asRecord(this.content[section]);
  }
}

const asRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? { ...value } : {});

// Locale fixée : sans elle, l'ordre dépend de la machine (en tchèque, « chalk » passe après « hono »).
const sortKeys = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b, 'en')));
