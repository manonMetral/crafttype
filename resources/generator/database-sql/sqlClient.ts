import { Pool, type QueryResult } from 'pg';

export interface SqlClient {
  query<T extends object>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<readonly T[]>;
  execute(sql: string, parameters?: readonly unknown[]): Promise<number>;
  close(): Promise<void>;
}

export interface SqlClientConfig {
  readonly connectionString: string;
  readonly ssl: boolean;
}

interface QueryablePool {
  query<T extends object>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

/** Reads DATABASE_URL and optional DATABASE_SSL (true/false) from the environment. */
export const sqlConfigFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): SqlClientConfig => {
  const connectionString = env['DATABASE_URL']?.trim() ?? '';
  if (connectionString === '') {
    throw new Error('Invalid DATABASE_URL: expected a non-empty string');
  }
  return { connectionString, ssl: parseBooleanFlag(env['DATABASE_SSL']) };
};

/** SQL client on top of `pg` (node-postgres). */
export class PostgresSqlClient implements SqlClient {
  constructor(private readonly pool: QueryablePool) {}

  async query<T extends object>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.pool.query<T>(sql, [...parameters]);
    return result.rows;
  }

  async execute(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<number> {
    const result = await this.pool.query(sql, [...parameters]);
    return result.rowCount ?? 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const createPostgresSqlClient = (config: SqlClientConfig): SqlClient =>
  new PostgresSqlClient(
    new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    }),
  );

function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === '') {
    return false;
  }
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  throw new Error(`Invalid DATABASE_SSL: "${value}" (expected true or false)`);
}
