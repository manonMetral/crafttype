import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { FileSystemProjectFiles } from './FileSystemProjectFiles.js';

describe('FileSystemProjectFiles', () => {
  const files = new FileSystemProjectFiles();

  it('écrit un fichier en créant les dossiers manquants, puis le relit', () => {
    const folder = tmpDirForTest();

    files.write(folder, 'src/a/b.txt', 'contenu');

    expect(files.read(folder, 'src/a/b.txt')).toBe('contenu');
  });

  it('rend undefined pour un fichier absent', () => {
    expect(files.read(tmpDirForTest(), 'absent.txt')).toBeUndefined();
  });

  it('ne masque pas une autre erreur de lecture', () => {
    const folder = tmpDirForTest();
    mkdirSync(join(folder, 'dossier'));

    expect(() => files.read(folder, 'dossier')).toThrow(/EISDIR/);
  });
});
