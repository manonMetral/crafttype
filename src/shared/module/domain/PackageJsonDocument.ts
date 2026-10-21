import type { PackageJsonChanges } from './CraftModule.js';
import { isRecord, parseJsonObject } from './jsonFile.js';

export const PACKAGE_JSON_PATH = 'package.json';

/** The four kinds of entries a module can set in the package.json. */
export type PackageJsonEntryKind = 'field' | 'script' | 'dependency' | 'devDependency';

/** A package.json entry; `value` is the JSON-serialized value. */
export interface PackageJsonEntry {
  readonly kind: PackageJsonEntryKind;
  readonly target: string;
  readonly value: string;
}

/**
 * Where each kind of entry lives in the package.json. This is the only mapping table: reading, writing,
 * sorting and labels all refer to it. `section` is `undefined` for a top-level field (`name`, `type`...).
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

/** Readable name of an entry: `package.json: scripts.test`. */
export const describePackageJsonEntry = (kind: PackageJsonEntryKind, target: string): string => {
  const { section } = KINDS[kind];
  return `${PACKAGE_JSON_PATH}: ${section === undefined ? '' : `${section}.`}${target}`;
};

/** The package.json of the generated project: read it, set entries in it, write it back without losing what the team put in it. */
export class PackageJsonDocument {
  private constructor(private readonly content: Readonly<Record<string, unknown>>) {}

  /** A missing file is an empty document; an unreadable file, or one that is not an object, is rejected. */
  static parse(raw: string | undefined): PackageJsonDocument {
    return new PackageJsonDocument(raw === undefined ? {} : parseJsonObject(PACKAGE_JSON_PATH, raw));
  }

  /** The entries the module wants to set, in the order fields, scripts, dependencies, development dependencies. */
  static wantedBy(changes: PackageJsonChanges): readonly PackageJsonEntry[] {
    return (Object.keys(KINDS) as PackageJsonEntryKind[]).flatMap((kind) =>
      Object.entries(KINDS[kind].wanted(changes)).map(([target, value]) => ({
        kind,
        target,
        value: JSON.stringify(value),
      })),
    );
  }

  /** Current value of the entry, serialized as JSON, or `undefined` if it does not exist. */
  entry(kind: PackageJsonEntryKind, target: string): string | undefined {
    const value = this.container(kind)[target];
    return value === undefined ? undefined : JSON.stringify(value);
  }

  /**
   * A new document with these entries set. The rest is kept as is; only the dependency lists that were
   * touched are sorted.
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

// Fixed locale: without it, the order depends on the machine (in Czech, "chalk" sorts after "hono").
const sortKeys = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b, 'en')));
