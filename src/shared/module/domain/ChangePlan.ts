import { ModuleConflictError } from './errors.js';
import { describePackageJsonEntry, type PackageJsonEntryKind } from './PackageJsonDocument.js';
import type { VersionComparator } from './ports.js';

/** What to do when a module wants to put content that differs from what already exists. */
export type ConflictPolicy = 'fail' | 'overwrite' | 'skip';

export type ChangeKind = 'file' | 'edit' | PackageJsonEntryKind;

/**
 * A change the module would like to make to the project.
 * `current` and `next` are the raw content for a file, a serialized JSON value for a package.json entry.
 */
export interface PlannedChange {
  readonly kind: ChangeKind;
  readonly target: string;
  readonly current: string | undefined;
  readonly next: string;
}

/**
 * `edit`: the module inserts code into an existing file, where a needle points. This is not a conflict: the policy
 * changes nothing about it, and a missing needle is an error of the module (see `NeedleError`), not a decision.
 * `keep`: a dependency is already present in a version equal to, newer than or compatible with the catalog's.
 * This is not a conflict and no policy replaces it, so that a version never goes backwards.
 * `conflict`: the conflict is not settled (`fail` policy), the module cannot be applied.
 */
export type Decision = 'create' | 'edit' | 'unchanged' | 'keep' | 'overwrite' | 'skip' | 'conflict';

export interface DecidedChange extends PlannedChange {
  readonly decision: Decision;
}

export interface ApplyReport {
  readonly created: number;
  readonly edited: number;
  readonly replaced: number;
  readonly unchanged: number;
  readonly kept: number;
  readonly skipped: number;
  readonly conflicts: number;
}

/** Readable name of the element concerned: the path of a file, or the package.json entry. */
export const describeChange = ({ kind, target }: PlannedChange): string =>
  kind === 'file' || kind === 'edit' ? target : describePackageJsonEntry(kind, target);

/** Description of a conflict: the element, and for package.json the existing value against the module's. */
export const describeConflict = (change: PlannedChange): string =>
  change.kind === 'file' || change.kind === 'edit'
    ? describeChange(change)
    : `${describeChange(change)} (existing: ${change.current}, module: ${change.next})`;

/** What a module would change in a project, before anything is written. */
export class ChangePlan {
  constructor(
    readonly changes: readonly PlannedChange[],
    private readonly versions: VersionComparator,
  ) {}

  /** Settles each change according to the policy, without ever failing: used by the dry run. */
  decide(policy: ConflictPolicy): readonly DecidedChange[] {
    return this.changes.map((change) => ({ ...change, decision: decisionFor(change, policy, this.versions) }));
  }

  /** Like `decide`, but rejects the plan if an unsettled conflict remains. */
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

/** A version in a package.json is a string; any other shape is compared as is, hence in conflict. */
const isJsonString = (value: string | undefined): boolean => value !== undefined && value.startsWith('"');

const decisionFor = (change: PlannedChange, policy: ConflictPolicy, versions: VersionComparator): Decision => {
  if (change.current === undefined) return 'create';
  if (change.current === change.next) return 'unchanged';
  if (change.kind === 'edit') return 'edit';
  if (
    isDependency(change) &&
    versions.keepsExistingVersion(JSON.parse(change.current) as string, JSON.parse(change.next) as string)
  )
    return 'keep';
  return { fail: 'conflict', overwrite: 'overwrite', skip: 'skip' }[policy] as Decision;
};

export const reportOf = (changes: readonly DecidedChange[]): ApplyReport => {
  const count = (decision: Decision): number => changes.filter((change) => change.decision === decision).length;
  return {
    created: count('create'),
    edited: count('edit'),
    replaced: count('overwrite'),
    unchanged: count('unchanged'),
    kept: count('keep'),
    skipped: count('skip'),
    conflicts: count('conflict'),
  };
};
