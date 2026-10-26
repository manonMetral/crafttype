/** Minimal contract for entities persisted in repositories of this project. */
export interface RepositoryEntity {
  readonly id: string;
}

/** Base repository contract for use cases that store and read entities. */
export interface Repository<T extends RepositoryEntity> {
  save(entity: T): Promise<void>;
  findById(id: string): Promise<T | undefined>;
  findAll(): Promise<readonly T[]>;
  delete(id: string): Promise<boolean>;
}
