import { describe, expect, it, vi } from 'vitest';
import { ChangePlan, describeConflict, reportOf, type PlannedChange } from './ChangePlan.js';
import { ModuleConflictError } from './errors.js';
import type { VersionComparator } from './ports.js';

const created: PlannedChange = { kind: 'file', target: 'a.ts', current: undefined, next: 'a' };
const unchanged: PlannedChange = { kind: 'file', target: 'b.ts', current: 'b', next: 'b' };
const fileConflict: PlannedChange = { kind: 'file', target: 'c.ts', current: 'perso', next: 'c' };
const scriptConflict: PlannedChange = { kind: 'script', target: 'test', current: '"jest"', next: '"vitest run"' };

/** Comparateur factice : ne garde que les versions listées, sans rien savoir de semver. */
const keeping = (...kept: string[]): VersionComparator => ({ keepsExistingVersion: (existing) => kept.includes(existing) });
const keepingNothing = keeping();

describe('ChangePlan', () => {
  const plan = new ChangePlan([created, unchanged, fileConflict, scriptConflict], keepingNothing);

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
    expect(new ChangePlan([created, unchanged], keepingNothing).resolve('fail')).toHaveLength(2);
  });

  it('accepte un plan avec conflits quand la politique les tranche', () => {
    expect(plan.resolve('skip')).toHaveLength(4);
    expect(plan.resolve('overwrite')).toHaveLength(4);
  });

  it('compte les décisions', () => {
    expect(reportOf(plan.decide('skip'))).toEqual({ created: 1, replaced: 0, unchanged: 1, kept: 0, skipped: 2, conflicts: 0 });
    expect(reportOf(plan.decide('fail'))).toEqual({ created: 1, replaced: 0, unchanged: 1, kept: 0, skipped: 0, conflicts: 2 });
  });

  it('décrit un conflit sur le package.json avec les deux valeurs', () => {
    expect(describeConflict(scriptConflict)).toBe('package.json : scripts.test (existant : "jest", module : "vitest run")');
    expect(describeConflict(fileConflict)).toBe('c.ts');
  });

  describe('versions de dépendances', () => {
    const dependency = (current: string, next = '"5.12.7"', kind: PlannedChange['kind'] = 'dependency'): PlannedChange => ({
      kind,
      target: 'fastify',
      current: JSON.stringify(current),
      next,
    });

    it.each(['fail', 'overwrite', 'skip'] as const)('conserve une version plus récente avec la politique %s', (policy) => {
      expect(new ChangePlan([dependency('5.13.0')], keeping('5.13.0')).decide(policy).map(({ decision }) => decision)).toEqual(['keep']);
      expect(new ChangePlan([dependency('^5.0.0', '"5.12.7"', 'devDependency')], keeping('^5.0.0')).decide(policy).map(({ decision }) => decision)).toEqual(['keep']);
    });

    it('traite une version plus ancienne ou illisible comme un conflit', () => {
      expect(new ChangePlan([dependency('4.29.0')], keepingNothing).decide('fail')[0]?.decision).toBe('conflict');
      expect(new ChangePlan([dependency('latest')], keepingNothing).decide('overwrite')[0]?.decision).toBe('overwrite');
      expect(new ChangePlan([dependency('workspace:*')], keepingNothing).decide('skip')[0]?.decision).toBe('skip');
    });

    it('ne compare pas une valeur qui n’est pas une chaîne', () => {
      const objectValue: PlannedChange = { kind: 'dependency', target: 'fastify', current: '{"version":"5.13.0"}', next: '"5.12.7"' };
      expect(new ChangePlan([objectValue], keeping('{"version":"5.13.0"}')).decide('fail')[0]?.decision).toBe('conflict');
    });

    it('ne compare pas les versions d’un script ou d’un fichier', () => {
      const script: PlannedChange = { kind: 'script', target: 'test', current: '"9.0.0"', next: '"1.0.0"' };
      expect(new ChangePlan([script], keeping('9.0.0')).decide('fail')[0]?.decision).toBe('conflict');
    });

    it('interroge le comparateur avec les versions lues, sans les guillemets JSON', () => {
      const versions = { keepsExistingVersion: vi.fn().mockReturnValue(false) };

      new ChangePlan([dependency('5.13.0')], versions).decide('fail');

      expect(versions.keepsExistingVersion).toHaveBeenCalledExactlyOnceWith('5.13.0', '5.12.7');
    });

    it('ne l’interroge ni pour un élément créé ou inchangé, ni pour un script', () => {
      const versions = { keepsExistingVersion: vi.fn().mockReturnValue(true) };

      new ChangePlan([created, unchanged, scriptConflict], versions).decide('fail');

      expect(versions.keepsExistingVersion).not.toHaveBeenCalled();
    });

    it('compte les versions conservées', () => {
      expect(reportOf(new ChangePlan([dependency('5.13.0'), created], keeping('5.13.0')).decide('fail'))).toMatchObject({ kept: 1, created: 1, conflicts: 0 });
    });
  });
});
