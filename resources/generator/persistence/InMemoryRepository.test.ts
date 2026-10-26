import { describe, expect, it } from 'vitest';
import { InMemoryRepository } from './InMemoryRepository.js';

type Item = { id: string; value: string };

describe('InMemoryRepository', () => {
  it('saves, reads, lists and deletes entities', async () => {
    const repository = new InMemoryRepository<Item>();

    await repository.save({ id: 'a', value: 'one' });
    await repository.save({ id: 'b', value: 'two' });
    await repository.save({ id: 'a', value: 'one-updated' });

    await expect(repository.findById('a')).resolves.toEqual({
      id: 'a',
      value: 'one-updated',
    });
    await expect(repository.findById('x')).resolves.toBeUndefined();
    await expect(repository.findAll()).resolves.toEqual([
      { id: 'a', value: 'one-updated' },
      { id: 'b', value: 'two' },
    ]);
    await expect(repository.delete('b')).resolves.toBe(true);
    await expect(repository.delete('b')).resolves.toBe(false);
  });
});
