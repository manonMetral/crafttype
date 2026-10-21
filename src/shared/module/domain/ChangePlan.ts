import { ModuleConflictError } from './errors.js';
import type { VersionComparator } from './ports.js';

/** Que faire quand un module veut poser un contenu différent de celui qui existe déjà. */
export type ConflictPolicy = 'fail' | 'overwrite' | 'skip';

export type ChangeKind = 'file' | 'field' | 'script' | 'dependency' | 'devDependency';

/**
 * Un changement que le module voudrait apporter au projet.
 * `current` et `next` sont le contenu brut pour un fichier, une valeur JSON sérialisée pour une entrée du package.json.
 */
export interface PlannedChange {
  readonly kind: ChangeKind;
  readonly target: string;
  readonly current: string | undefined;
  readonly next: string;
}

/**
 * `keep` : une dépendance est déjà présente dans une version égale, plus récente ou compatible avec celle du catalogue.
 * Ce n'est pas un conflit et aucune politique ne la remplace, pour ne jamais faire reculer une version.
 * `conflict` : le conflit n'est pas tranché (politique `fail`), le module ne peut pas être appliqué.
 */
export type Decision = 'create' | 'unchanged' | 'keep' | 'overwrite' | 'skip' | 'conflict';

export interface DecidedChange extends PlannedChange {
  readonly decision: Decision;
}

export interface ApplyReport {
  readonly created: number;
  readonly replaced: number;
  readonly unchanged: number;
  readonly kept: number;
  readonly skipped: number;
  readonly conflicts: number;
}

const PACKAGE_JSON = 'package.json';

const PACKAGE_JSON_SECTION: Record<Exclude<ChangeKind, 'file'>, string> = {
  field: '',
  script: 'scripts.',
  dependency: 'dependencies.',
  devDependency: 'devDependencies.',
};

/** Nom lisible de l'élément concerné : le chemin d'un fichier, ou l'entrée du package.json. */
export const describeChange = ({ kind, target }: PlannedChange): string =>
  kind === 'file' ? target : `${PACKAGE_JSON} : ${PACKAGE_JSON_SECTION[kind]}${target}`;

/** Description d'un conflit : l'élément, et pour le package.json la valeur existante face à celle du module. */
export const describeConflict = (change: PlannedChange): string =>
  change.kind === 'file' ? describeChange(change) : `${describeChange(change)} (existant : ${change.current}, module : ${change.next})`;

/** Ce qu'un module changerait dans un projet, avant toute écriture. */
export class ChangePlan {
  constructor(
    readonly changes: readonly PlannedChange[],
    private readonly versions: VersionComparator,
  ) {}

  /** Tranche chaque changement selon la politique, sans jamais échouer : sert à la simulation. */
  decide(policy: ConflictPolicy): readonly DecidedChange[] {
    return this.changes.map((change) => ({ ...change, decision: decisionFor(change, policy, this.versions) }));
  }

  /** Comme `decide`, mais refuse le plan s'il reste un conflit non tranché. */
  resolve(policy: ConflictPolicy): readonly DecidedChange[] {
    const decided = this.decide(policy);
    const conflicts = decided.filter(({ decision }) => decision === 'conflict');
    if (conflicts.length > 0) {
      throw new ModuleConflictError(conflicts.map(describeConflict));
    }
    return decided;
  }
}

const isDependency = ({ kind, current, next }: PlannedChange): boolean =>
  (kind === 'dependency' || kind === 'devDependency') && isJsonString(current) && isJsonString(next);

/** Une version dans un package.json est une chaîne ; toute autre forme est comparée telle quelle, donc en conflit. */
const isJsonString = (value: string | undefined): boolean => value !== undefined && value.startsWith('"');

const decisionFor = (change: PlannedChange, policy: ConflictPolicy, versions: VersionComparator): Decision => {
  if (change.current === undefined) return 'create';
  if (change.current === change.next) return 'unchanged';
  if (isDependency(change) && versions.keepsExistingVersion(JSON.parse(change.current) as string, JSON.parse(change.next) as string)) return 'keep';
  return { fail: 'conflict', overwrite: 'overwrite', skip: 'skip' }[policy] as Decision;
};

export const reportOf = (changes: readonly DecidedChange[]): ApplyReport => {
  const count = (decision: Decision): number => changes.filter((change) => change.decision === decision).length;
  return {
    created: count('create'),
    replaced: count('overwrite'),
    unchanged: count('unchanged'),
    kept: count('keep'),
    skipped: count('skip'),
    conflicts: count('conflict'),
  };
};
