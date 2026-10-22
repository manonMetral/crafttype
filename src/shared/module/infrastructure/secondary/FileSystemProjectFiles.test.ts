import { chmodSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { FileSystemProjectFiles } from './FileSystemProjectFiles.js';

// A permission cannot be taken away from root, nor from a Windows file.
const canRestrictPermissions = process.platform !== 'win32' && process.getuid?.() !== 0;

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

  describe('replacing a file', () => {
    it('replaces the content and leaves no temporary file next to it', () => {
      const folder = tmpDirForTest();
      files.write(folder, 'package.json', 'old');

      files.write(folder, 'package.json', 'new');

      expect(files.read(folder, 'package.json')).toBe('new');
      expect(readdirSync(folder)).toEqual(['package.json']);
    });

    it.skipIf(process.platform === 'win32')('keeps the mode of the existing file', () => {
      const folder = tmpDirForTest();
      writeFileSync(join(folder, 'run.sh'), 'old');
      chmodSync(join(folder, 'run.sh'), 0o750);

      files.write(folder, 'run.sh', 'new');

      expect(statSync(join(folder, 'run.sh')).mode & 0o777).toBe(0o750);
    });

    it.skipIf(process.platform === 'win32')('writes through a symbolic link instead of replacing the link', () => {
      const folder = tmpDirForTest();
      writeFileSync(join(folder, 'real.txt'), 'old');
      symlinkSync('real.txt', join(folder, 'link.txt'));

      files.write(folder, 'link.txt', 'new');

      expect(readFileSync(join(folder, 'real.txt'), 'utf8')).toBe('new');
      expect(statSync(join(folder, 'link.txt')).isFile()).toBe(true);
    });

    it('removes its temporary file when the replacement fails', () => {
      const folder = tmpDirForTest();
      mkdirSync(join(folder, 'target'));
      writeFileSync(join(folder, 'target', 'inside.txt'), 'kept');

      expect(() => files.write(folder, 'target', 'content')).toThrow();

      expect(readdirSync(folder)).toEqual(['target']);
      expect(readFileSync(join(folder, 'target', 'inside.txt'), 'utf8')).toBe('kept');
    });

    it.skipIf(!canRestrictPermissions)('leaves the existing file intact when the folder is read-only', () => {
      const folder = tmpDirForTest();
      files.write(folder, 'package.json', 'precious');
      chmodSync(folder, 0o555);

      try {
        expect(() => files.write(folder, 'package.json', 'new')).toThrow(/EACCES/);
      } finally {
        chmodSync(folder, 0o755);
      }

      expect(files.read(folder, 'package.json')).toBe('precious');
      expect(readdirSync(folder)).toEqual(['package.json']);
    });
  });
});
