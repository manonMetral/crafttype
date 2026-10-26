import { describe, expect, it, vi } from 'vitest';
import type { SqlClient } from '../sqlClient.js';
import { SqlUserRepository } from './SqlUserRepository.js';

describe('SqlUserRepository', () => {
  const sqlClient = () => {
    const queryMock =
      vi.fn<
        (
          sql: string,
          parameters?: readonly unknown[],
        ) => Promise<readonly unknown[]>
      >();
    const execute = vi.fn<SqlClient['execute']>().mockResolvedValue(1);
    const close = vi.fn<SqlClient['close']>().mockResolvedValue(undefined);
    const query: SqlClient['query'] = async <T extends object>(
      sql: string,
      parameters?: readonly unknown[],
    ): Promise<readonly T[]> => {
      const rows = await queryMock(sql, parameters);
      return rows as readonly T[];
    };
    const sql: SqlClient = { query, execute, close };
    return { sql, queryMock, execute };
  };

  it('creates the users table', async () => {
    const { sql, execute } = sqlClient();
    const repository = new SqlUserRepository(sql);

    await repository.initialize();

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toContain(
      'CREATE TABLE IF NOT EXISTS users',
    );
  });

  it('saves and reads users', async () => {
    const { sql, queryMock, execute } = sqlClient();
    const repository = new SqlUserRepository(sql);
    queryMock
      .mockResolvedValueOnce([
        { id: 'u1', email: 'alice@example.test', display_name: 'Alice' },
      ])
      .mockResolvedValueOnce([
        { id: 'u2', email: 'bob@example.test', display_name: 'Bob' },
        { id: 'u1', email: 'alice@example.test', display_name: 'Alice' },
      ]);

    await repository.save({
      id: 'u1',
      email: 'alice@example.test',
      displayName: 'Alice',
    });

    await expect(repository.findById('u1')).resolves.toEqual({
      id: 'u1',
      email: 'alice@example.test',
      displayName: 'Alice',
    });
    await expect(repository.findAll()).resolves.toEqual([
      { id: 'u2', email: 'bob@example.test', displayName: 'Bob' },
      { id: 'u1', email: 'alice@example.test', displayName: 'Alice' },
    ]);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['u1', 'alice@example.test', 'Alice'],
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE id = $1'),
      ['u1'],
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('ORDER BY email ASC'),
      undefined,
    );
  });

  it('deletes users and reports whether one row was removed', async () => {
    const { sql, execute } = sqlClient();
    const repository = new SqlUserRepository(sql);
    execute.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expect(repository.delete('u1')).resolves.toBe(true);
    await expect(repository.delete('missing')).resolves.toBe(false);
  });
});
