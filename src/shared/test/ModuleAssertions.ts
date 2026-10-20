import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { createModulesApplicationService } from '../../composition.js';
import type { ModuleProperties } from '../module/domain/ModuleProperties.js';
import type { CraftModule } from '../module/domain/CraftModule.js';

export const tmpDirForTest = (): string => mkdtempSync(join(tmpdir(), 'crafttype-test-'));

export const propertiesFixture = (overrides: Partial<ModuleProperties> = {}): ModuleProperties => ({
  projectFolder: tmpDirForTest(),
  projectName: 'my-app',
  serverPort: 3000,
  ...overrides,
});

/** Applique réellement le module sur un dossier temporaire (même principe que `assertThatModule` de Seed4J). */
export const assertThatModule = (module: CraftModule): ModuleAssertions => {
  createModulesApplicationService().applyModule(module);
  return new ModuleAssertions(module.projectFolder);
};

export class ModuleAssertions {
  constructor(readonly projectFolder: string) {}

  hasFiles(...paths: string[]): this {
    for (const path of paths) {
      expect(existsSync(join(this.projectFolder, path)), `fichier attendu : ${path}`).toBe(true);
    }
    return this;
  }

  hasFileContaining(path: string, ...fragments: string[]): this {
    this.hasFiles(path);
    const content = readFileSync(join(this.projectFolder, path), 'utf8');
    for (const fragment of fragments) {
      expect(content).toContain(fragment);
    }
    return this;
  }

  hasPackageJson(): { dependencies: Record<string, string>; devDependencies: Record<string, string>; scripts: Record<string, string>; [key: string]: unknown } {
    return JSON.parse(readFileSync(join(this.projectFolder, 'package.json'), 'utf8'));
  }

  cleanup(): void {
    rmSync(this.projectFolder, { recursive: true, force: true });
  }
}
