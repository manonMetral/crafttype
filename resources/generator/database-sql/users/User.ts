import type { RepositoryEntity } from '../../persistence/Repository.js';

/** Example entity persisted in SQL through the repository contract. */
export interface User extends RepositoryEntity {
  readonly email: string;
  readonly displayName: string;
}
