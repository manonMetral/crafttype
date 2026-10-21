import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { FileSystemProjectFiles } from './FileSystemProjectFiles.js';

describe('FileSystemProjectFiles', () => {
  const files = new FileSystemProjectFiles();

  it('writes a file creating the missing folders, then reads it back', () => {
    const folder = tmpDirForTest();

    files.write(folder, 'src/a/b.txt', 'content');

    expect(files.read(folder, 'src/a/b.txt')).toBe('content');
  });

  it('returns undefined for a missing file', () => {
    expect(files.read(tmpDirForTest(), 'missing.txt')).toBeUndefined();
  });

  it('does not hide another read error', () => {
    const folder = tmpDirForTest();
    mkdirSync(join(folder, 'folder'));

    expect(() => files.read(folder, 'folder')).toThrow(/EISDIR/);
  });
});
