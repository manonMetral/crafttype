import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// One registry per test file (Vitest isolates modules per file): `setup.ts` empties it after the file's tests.
const created = new Set<string>();

/** A new empty folder in the OS temporary folder, removed after the tests of the file (also when a test fails). */
export const tmpDirForTest = (): string => {
  const folder = mkdtempSync(join(tmpdir(), 'crafttype-test-'));
  created.add(folder);
  return folder;
};

export const removeTmpDirsOfTests = (): void => {
  for (const folder of created) {
    rmSync(folder, { recursive: true, force: true });
  }
  created.clear();
};
