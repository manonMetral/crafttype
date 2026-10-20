import type { AppliedModule, ModulesHistory, ProjectFiles } from '../../domain/ports.js';

const HISTORY_PATH = '.crafttype/modules/history.json';

export class FileSystemModulesHistory implements ModulesHistory {
  constructor(private readonly files: ProjectFiles) {}

  list(projectFolder: string): readonly AppliedModule[] {
    const content = this.files.read(projectFolder, HISTORY_PATH);
    return content === undefined ? [] : (JSON.parse(content).modules as AppliedModule[]);
  }

  record(projectFolder: string, applied: AppliedModule): void {
    const others = this.list(projectFolder).filter(({ slug }) => slug !== applied.slug);
    this.files.write(projectFolder, HISTORY_PATH, `${JSON.stringify({ modules: [...others, applied] }, null, 2)}\n`);
  }
}
