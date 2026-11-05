import type { ModulesHistory, ProjectFiles, ProjectSimulator } from '../../domain/ports.js';
import { FileSystemModulesHistory } from './FileSystemModulesHistory.js';
import { OverlayProjectFiles } from './OverlayProjectFiles.js';

/** Simulates on top of the real files: the history of the simulation is written in memory like any other file. */
export class OverlayProjectSimulator implements ProjectSimulator {
  constructor(private readonly files: ProjectFiles) {}

  start(): { readonly files: ProjectFiles; readonly history: ModulesHistory } {
    const files = new OverlayProjectFiles(this.files);
    return { files, history: new FileSystemModulesHistory(files) };
  }
}
