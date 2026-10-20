import { describe, expect, it } from 'vitest';
import { ChangePlan, describeConflict, reportOf, type PlannedChange } from './ChangePlan.js';
import { ModuleConflictError } from './errors.js';

const created: PlannedChange = { kind: 'file', target: 'a.ts', current: undefined, next: 'a' };
const unchanged: PlannedChange = { kind: 'file', target: 'b.ts', current: 'b', next: 'b' };
const fileConflict: PlannedChange = { kind: 'file', target: 'c.ts', current: 'perso', next: 'c' };
const scriptConflict: PlannedChange = { kind: 'script', target: 'test', current: '"jest"', next: '"vitest run"' };

describe('ChangePlan', () => {
  const plan = new ChangePlan([created, unchanged, fileConflict, scriptConflict]);

  it.each([
    ['fail', ['create', 'unchanged', 'conflict', 'conflict']],
    ['overwrite', ['create', 'unchanged', 'overwrite', 'overwrite']],
    ['skip', ['create', 'unchanged', 'skip', 'skip']],
  ] as const)('tranche les changements avec la politique %s', (policy, expected) => {
    expect(plan.decide(policy).map(({ decision }) => decision)).toEqual(expected);
  });

  it('refuse un plan avec conflit non tranché en listant tous les conflits', () => {
    expect(() => plan.resolve('fail')).toThrow(ModuleConflictError);
    expect(() => plan.resolve('fail')).toThrow(/c\.ts.*package\.json : scripts\.test/s);
  });

  it('accepte un plan sans conflit avec la politique par défaut', () => {
    expect(new ChangePlan([created, unchanged]).resolve('fail')).toHaveLength(2);
  });

  it('accepte un plan avec conflits quand la politique les tranche', () => {
    expect(plan.resolve('skip')).toHaveLength(4);
    expect(plan.resolve('overwrite')).toHaveLength(4);
  });

  it('compte les décisions', () => {
    expect(reportOf(plan.decide('skip'))).toEqual({ created: 1, replaced: 0, unchanged: 1, skipped: 2, conflicts: 0 });
    expect(reportOf(plan.decide('fail'))).toEqual({ created: 1, replaced: 0, unchanged: 1, skipped: 0, conflicts: 2 });
  });

  it('décrit un conflit sur le package.json avec les deux valeurs', () => {
    expect(describeConflict(scriptConflict)).toBe('package.json : scripts.test (existant : "jest", module : "vitest run")');
    expect(describeConflict(fileConflict)).toBe('c.ts');
  });
});
