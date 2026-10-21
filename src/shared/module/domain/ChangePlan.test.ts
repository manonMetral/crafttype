import { describe, expect, it, vi } from 'vitest';
import { ChangePlan, describeChange, describeConflict, reportOf, type PlannedChange } from './ChangePlan.js';
import { ModuleConflictError } from './errors.js';
import type { VersionComparator } from './ports.js';

const created: PlannedChange = { kind: 'file', target: 'a.ts', current: undefined, next: 'a' };
const unchanged: PlannedChange = { kind: 'file', target: 'b.ts', current: 'b', next: 'b' };
const fileConflict: PlannedChange = { kind: 'file', target: 'c.ts', current: 'custom', next: 'c' };
const scriptConflict: PlannedChange = { kind: 'script', target: 'test', current: '"jest"', next: '"vitest run"' };

/** Fake comparator: only keeps the listed versions, knowing nothing about semver. */
const keeping = (...kept: string[]): VersionComparator => ({
  keepsExistingVersion: (existing) => kept.includes(existing),
});
const keepingNothing = keeping();

describe('ChangePlan', () => {
  const plan = new ChangePlan([created, unchanged, fileConflict, scriptConflict], keepingNothing);

  it.each([
    ['fail', ['create', 'unchanged', 'conflict', 'conflict']],
    ['overwrite', ['create', 'unchanged', 'overwrite', 'overwrite']],
    ['skip', ['create', 'unchanged', 'skip', 'skip']],
  ] as const)('settles the changes with the %s policy', (policy, expected) => {
    expect(plan.decide(policy).map(({ decision }) => decision)).toEqual(expected);
  });

  it('rejects a plan with an unsettled conflict, listing all conflicts', () => {
    expect(() => plan.resolve('fail')).toThrow(ModuleConflictError);
    expect(() => plan.resolve('fail')).toThrow(/c\.ts.*package\.json: scripts\.test/s);
  });

  it('accepts a plan without conflicts with the default policy', () => {
    expect(new ChangePlan([created, unchanged], keepingNothing).resolve('fail')).toHaveLength(2);
  });

  it('accepts a plan with conflicts when the policy settles them', () => {
    expect(plan.resolve('skip')).toHaveLength(4);
    expect(plan.resolve('overwrite')).toHaveLength(4);
  });

  it('counts the decisions', () => {
    expect(reportOf(plan.decide('skip'))).toEqual({
      created: 1,
      edited: 0,
      replaced: 0,
      unchanged: 1,
      kept: 0,
      skipped: 2,
      conflicts: 0,
    });
    expect(reportOf(plan.decide('fail'))).toEqual({
      created: 1,
      edited: 0,
      replaced: 0,
      unchanged: 1,
      kept: 0,
      skipped: 0,
      conflicts: 2,
    });
  });

  it('describes a package.json conflict with both values', () => {
    expect(describeConflict(scriptConflict)).toBe(
      'package.json: scripts.test (existing: "jest", module: "vitest run")',
    );
    expect(describeConflict(fileConflict)).toBe('c.ts');
  });

  describe('dependency versions', () => {
    const dependency = (
      current: string,
      next = '"5.12.7"',
      kind: PlannedChange['kind'] = 'dependency',
    ): PlannedChange => ({
      kind,
      target: 'fastify',
      current: JSON.stringify(current),
      next,
    });

    it.each(['fail', 'overwrite', 'skip'] as const)('keeps a newer version with the %s policy', (policy) => {
      expect(
        new ChangePlan([dependency('5.13.0')], keeping('5.13.0')).decide(policy).map(({ decision }) => decision),
      ).toEqual(['keep']);
      expect(
        new ChangePlan([dependency('^5.0.0', '"5.12.7"', 'devDependency')], keeping('^5.0.0'))
          .decide(policy)
          .map(({ decision }) => decision),
      ).toEqual(['keep']);
    });

    it('treats an older or unreadable version as a conflict', () => {
      expect(new ChangePlan([dependency('4.29.0')], keepingNothing).decide('fail')[0]?.decision).toBe('conflict');
      expect(new ChangePlan([dependency('latest')], keepingNothing).decide('overwrite')[0]?.decision).toBe('overwrite');
      expect(new ChangePlan([dependency('workspace:*')], keepingNothing).decide('skip')[0]?.decision).toBe('skip');
    });

    it('does not compare a value that is not a string', () => {
      const objectValue: PlannedChange = {
        kind: 'dependency',
        target: 'fastify',
        current: '{"version":"5.13.0"}',
        next: '"5.12.7"',
      };
      expect(new ChangePlan([objectValue], keeping('{"version":"5.13.0"}')).decide('fail')[0]?.decision).toBe(
        'conflict',
      );
    });

    it('does not compare the versions of a script or a file', () => {
      const script: PlannedChange = { kind: 'script', target: 'test', current: '"9.0.0"', next: '"1.0.0"' };
      expect(new ChangePlan([script], keeping('9.0.0')).decide('fail')[0]?.decision).toBe('conflict');
    });

    it('queries the comparator with the versions read, without the JSON quotes', () => {
      const versions = { keepsExistingVersion: vi.fn().mockReturnValue(false) };

      new ChangePlan([dependency('5.13.0')], versions).decide('fail');

      expect(versions.keepsExistingVersion).toHaveBeenCalledExactlyOnceWith('5.13.0', '5.12.7');
    });

    it('does not query it for a created or unchanged element, nor for a script', () => {
      const versions = { keepsExistingVersion: vi.fn().mockReturnValue(true) };

      new ChangePlan([created, unchanged, scriptConflict], versions).decide('fail');

      expect(versions.keepsExistingVersion).not.toHaveBeenCalled();
    });

    it('counts the kept versions', () => {
      expect(reportOf(new ChangePlan([dependency('5.13.0'), created], keeping('5.13.0')).decide('fail'))).toMatchObject(
        { kept: 1, created: 1, conflicts: 0 },
      );
    });
  });
  describe('modification of an existing file', () => {
    const edit: PlannedChange = {
      kind: 'edit',
      target: 'src/main.ts',
      current: 'a\n// crafttype-needle-x',
      next: 'a\nb\n// crafttype-needle-x',
    };

    it.each(['fail', 'overwrite', 'skip'] as const)('applies it with the %s policy: it is not a conflict', (policy) => {
      expect(new ChangePlan([edit], keepingNothing).decide(policy).map(({ decision }) => decision)).toEqual(['edit']);
      expect(new ChangePlan([edit], keepingNothing).resolve(policy)).toHaveLength(1);
    });

    it('does nothing when the file already contains the insertion', () => {
      const done = { ...edit, current: edit.next };

      expect(new ChangePlan([done], keepingNothing).decide('fail')[0]?.decision).toBe('unchanged');
    });

    it('is described by the file path', () => {
      expect(describeChange(edit)).toBe('src/main.ts');
      expect(describeConflict(edit)).toBe('src/main.ts');
    });

    it('counts the modified files', () => {
      expect(reportOf(new ChangePlan([edit, created], keepingNothing).decide('fail'))).toMatchObject({
        edited: 1,
        created: 1,
        conflicts: 0,
      });
    });
  });
});
