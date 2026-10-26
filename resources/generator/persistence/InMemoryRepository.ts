import type { Repository, RepositoryEntity } from './Repository.js';

/** In-memory adapter of Repository: useful for tests and local development. */
export class InMemoryRepository<
  T extends RepositoryEntity,
> implements Repository<T> {
  private readonly entities = new Map<string, T>();

  async save(entity: T): Promise<void> {
    this.entities.set(entity.id, entity);
  }

  async findById(id: string): Promise<T | undefined> {
    return this.entities.get(id);
  }

  async findAll(): Promise<readonly T[]> {
    return [...this.entities.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.entities.delete(id);
  }
}
