import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Repository, RepositoryEntity } from './Repository.js';

/**
 * JSON file adapter of Repository.
 *
 * The file stores an array of entities. `deserialize` validates one item and
 * returns `undefined` for invalid data.
 */
export class JsonFileRepository<
  T extends RepositoryEntity,
> implements Repository<T> {
  constructor(
    private readonly filePath: string,
    private readonly deserialize: (raw: unknown) => T | undefined,
  ) {}

  async save(entity: T): Promise<void> {
    const entities = await this.loadMap();
    entities.set(entity.id, entity);
    await this.persist(entities);
  }

  async findById(id: string): Promise<T | undefined> {
    const entities = await this.loadMap();
    return entities.get(id);
  }

  async findAll(): Promise<readonly T[]> {
    const entities = await this.loadMap();
    return [...entities.values()];
  }

  async delete(id: string): Promise<boolean> {
    const entities = await this.loadMap();
    const deleted = entities.delete(id);
    await this.persist(entities);
    return deleted;
  }

  private async loadMap(): Promise<Map<string, T>> {
    const parsed = await this.readStored();
    if (!Array.isArray(parsed)) {
      throw new Error(
        `Invalid repository file ${this.filePath}: expected an array`,
      );
    }
    const entities = parsed.map((entry, index) => {
      const entity = this.deserialize(entry);
      if (entity === undefined) {
        throw new Error(`Invalid entity at index ${index} in ${this.filePath}`);
      }
      return entity;
    });
    return new Map(entities.map((entity) => [entity.id, entity]));
  }

  private async readStored(): Promise<unknown> {
    try {
      const content = await readFile(this.filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    }
  }

  private async persist(entities: Map<string, T>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify([...entities.values()], null, 2),
    );
  }
}

const isFileNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';
