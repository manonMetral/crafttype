import type { Repository } from '../../persistence/Repository.js';
import type { SqlClient } from '../sqlClient.js';
import type { User } from './User.js';

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly display_name: string;
}

/** Example PostgreSQL repository implementing the generic persistence contract. */
export class SqlUserRepository implements Repository<User> {
  constructor(private readonly sql: SqlClient) {}

  async initialize(): Promise<void> {
    await this.sql.execute(
      `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL
      )
      `,
    );
  }

  async save(user: User): Promise<void> {
    await this.sql.execute(
      `
      INSERT INTO users (id, email, display_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          display_name = EXCLUDED.display_name
      `,
      [user.id, user.email, user.displayName],
    );
  }

  async findById(id: string): Promise<User | undefined> {
    const rows = await this.sql.query<UserRow>(
      `
      SELECT id, email, display_name
      FROM users
      WHERE id = $1
      `,
      [id],
    );
    const row = rows[0];
    return row === undefined ? undefined : toUser(row);
  }

  async findAll(): Promise<readonly User[]> {
    const rows = await this.sql.query<UserRow>(
      `
      SELECT id, email, display_name
      FROM users
      ORDER BY email ASC
      `,
    );
    return rows.map(toUser);
  }

  async delete(id: string): Promise<boolean> {
    const affectedRows = await this.sql.execute(
      `
      DELETE FROM users
      WHERE id = $1
      `,
      [id],
    );
    return affectedRows > 0;
  }
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
});
