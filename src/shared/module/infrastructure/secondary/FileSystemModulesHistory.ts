import { InvalidProjectFileError } from '../../domain/errors.js';
import { isRecord, parseJsonObject } from '../../domain/jsonFile.js';
import type { AppliedModule, ModulesHistory, ProjectFiles } from '../../domain/ports.js';

const HISTORY_PATH = '.crafttype/modules/history.json';

export class FileSystemModulesHistory implements ModulesHistory {
  constructor(private readonly files: ProjectFiles) {}

  list(projectFolder: string): readonly AppliedModule[] {
    const content = this.files.read(projectFolder, HISTORY_PATH);
    if (content === undefined) {
      return [];
    }

    const { modules } = parseJsonObject(HISTORY_PATH, content);
    if (!Array.isArray(modules) || !modules.every(isAppliedModule)) {
      throw new InvalidProjectFileError(HISTORY_PATH, 'une liste « modules » de modules appliqués est attendue');
    }
    return modules;
  }

  record(projectFolder: string, applied: AppliedModule): void {
    const others = this.list(projectFolder).filter(({ slug }) => slug !== applied.slug);
    this.files.write(projectFolder, HISTORY_PATH, `${JSON.stringify({ modules: [...others, applied] }, null, 2)}\n`);
  }
}

const isAppliedModule = (value: unknown): value is AppliedModule =>
  isRecord(value) &&
  typeof value['slug'] === 'string' &&
  isRecord(value['properties']) &&
  typeof value['appliedAt'] === 'string';
