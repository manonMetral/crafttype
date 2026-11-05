import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { FileSystemProjectFiles } from './FileSystemProjectFiles.js';
import { OverlayProjectFiles } from './OverlayProjectFiles.js';

describe('OverlayProjectFiles', () => {
  const project = (files: Record<string, string> = {}) => {
    const folder = tmpDirForTest();
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(folder, path, '..'), { recursive: true });
      writeFileSync(join(folder, path), content);
    }
    return { folder, overlay: new OverlayProjectFiles(new FileSystemProjectFiles()) };
  };

  it('reads what the project holds', () => {
    const { folder, overlay } = project({ 'src/a.ts': 'real' });

    expect(overlay.read(folder, 'src/a.ts')).toBe('real');
    expect(overlay.read(folder, 'src/missing.ts')).toBeUndefined();
  });

  it('reads what was written, in place of what the project holds', () => {
    const { folder, overlay } = project({ 'a.txt': 'real' });

    overlay.write(folder, 'a.txt', 'simulated');
    overlay.write(folder, 'new/b.txt', 'created');

    expect(overlay.read(folder, 'a.txt')).toBe('simulated');
    expect(overlay.read(folder, 'new/b.txt')).toBe('created');
  });

  it('never touches the project', () => {
    const { folder, overlay } = project({ 'a.txt': 'real' });

    overlay.write(folder, 'a.txt', 'simulated');
    overlay.write(folder, 'new/b.txt', 'created');

    expect(readFileSync(join(folder, 'a.txt'), 'utf8')).toBe('real');
    expect(existsSync(join(folder, 'new'))).toBe(false);
  });

  it('reads an empty file that was written, not the one of the project', () => {
    const { folder, overlay } = project({ 'a.txt': 'real' });

    overlay.write(folder, 'a.txt', '');

    expect(overlay.read(folder, 'a.txt')).toBe('');
  });

  it('recognizes a file whatever way its path is written', () => {
    const { folder, overlay } = project();

    overlay.write(folder, 'src/a.ts', 'content');

    expect(overlay.read(`${folder}/`, './src//a.ts')).toBe('content');
    expect(overlay.read(folder, 'src/x/../a.ts')).toBe('content');
  });

  it('keeps the files of two folders apart', () => {
    const first = project();
    const second = project();

    first.overlay.write(first.folder, 'a.txt', 'first');

    expect(first.overlay.read(second.folder, 'a.txt')).toBeUndefined();
  });

  it('is not shared with another overlay of the same project', () => {
    const { folder, overlay } = project();
    const other = new OverlayProjectFiles(new FileSystemProjectFiles());

    overlay.write(folder, 'a.txt', 'mine');

    expect(other.read(folder, 'a.txt')).toBeUndefined();
  });
});
