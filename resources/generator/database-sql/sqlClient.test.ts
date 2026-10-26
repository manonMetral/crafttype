import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresSqlClient,
  PostgresSqlClient,
  sqlConfigFromEnv,
  type SqlClientConfig,
} from './sqlClient.js';

describe('sqlConfigFromEnv', () => {
  it('reads DATABASE_URL and defaults DATABASE_SSL to false', () => {
    expect(
      sqlConfigFromEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/app',
      }),
    ).toEqual({
      connectionString: 'postgres://user:pass@localhost:5432/app',
      ssl: false,
    } satisfies SqlClientConfig);
  });

  it('accepts DATABASE_SSL=true and false', () => {
    expect(
      sqlConfigFromEnv({
        DATABASE_URL: 'postgres://db/app',
        DATABASE_SSL: 'true',
      }).ssl,
    ).toBe(true);
    expect(
      sqlConfigFromEnv({
        DATABASE_URL: 'postgres://db/app',
        DATABASE_SSL: 'false',
      }).ssl,
    ).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(() => sqlConfigFromEnv({ DATABASE_URL: '' })).toThrow(
      'Invalid DATABASE_URL',
    );
    expect(() =>
      sqlConfigFromEnv({
        DATABASE_URL: 'postgres://db/app',
        DATABASE_SSL: 'enabled',
      }),
    ).toThrow('Invalid DATABASE_SSL');
  });
});

describe('PostgresSqlClient', () => {
  it('delegates query and execute to the pool', async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'u1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 2 }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    const client = new PostgresSqlClient(pool);

    await expect(
      client.query<{ id: string }>('select id from users where id = $1', [
        'u1',
      ]),
    ).resolves.toEqual([{ id: 'u1' }]);
    await expect(
      client.execute('delete from users where id = $1', ['u1']),
    ).resolves.toBe(2);
    await client.close();

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'select id from users where id = $1',
      ['u1'],
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'delete from users where id = $1',
      ['u1'],
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('creates a configured postgres client', async () => {
    const client = createPostgresSqlClient({
      connectionString: 'postgres://user:pass@localhost:5432/app',
      ssl: true,
    });

    await expect(client.close()).resolves.toBeUndefined();
  });
});
