import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonFileRepository } from './JsonFileRepository.js';

type Item = { id: string; value: string };

const asItem = (raw: unknown): Item | undefined =>
  typeof raw === 'object' &&
  raw !== null &&
  'id' in raw &&
  'value' in raw &&
  typeof raw.id === 'string' &&
  typeof raw.value === 'string'
    ? { id: raw.id, value: raw.value }
    : undefined;

describe('JsonFileRepository', () => {
  const folders: string[] = [];

  afterEach(async () => {
    await Promise.all(
      folders.map((folder) => rm(folder, { recursive: true, force: true })),
    );
    folders.length = 0;
  });

  const createRepository = async () => {
    const folder = await mkdtemp(join(tmpdir(), 'repo-'));
    folders.push(folder);
    return {
      filePath: join(folder, 'storage', 'items.json'),
      repository: new JsonFileRepository<Item>(
        join(folder, 'storage', 'items.json'),
        asItem,
      ),
    };
  };

  it('creates the file on first write and reads back what it stores', async () => {
    const { filePath, repository } = await createRepository();

    await repository.save({ id: 'a', value: 'one' });
    await repository.save({ id: 'b', value: 'two' });

    await expect(repository.findById('b')).resolves.toEqual({
      id: 'b',
      value: 'two',
    });
    await expect(repository.findAll()).resolves.toEqual([
      { id: 'a', value: 'one' },
      { id: 'b', value: 'two' },
    ]);
    await expect(readFile(filePath, 'utf8')).resolves.toContain('"id": "a"');
  });

  it('deletes an entity and persists the updated list', async () => {
    const { filePath, repository } = await createRepository();
    await repository.save({ id: 'a', value: 'one' });
    await repository.save({ id: 'b', value: 'two' });

    await expect(repository.delete('a')).resolves.toBe(true);
    await expect(repository.delete('missing')).resolves.toBe(false);
    await expect(repository.findAll()).resolves.toEqual([
      { id: 'b', value: 'two' },
    ]);
    await expect(readFile(filePath, 'utf8')).resolves.not.toContain(
      '"id": "a"',
    );
  });

  it('rejects an invalid JSON shape from disk', async () => {
    const { filePath, repository } = await createRepository();
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{"invalid":true}');

    await expect(repository.findAll()).rejects.toThrow('expected an array');
  });
});
