import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../composition.js';
import { runCli } from '../../shared/module/infrastructure/primary/cli.js';
import { tmpDirForTest } from '../../shared/test/ModuleAssertions.js';

// Équivalent des tests Cucumber de Seed4J : on passe par la porte d'entrée (ici la CLI) et on vérifie
// seulement qu'un module est bien branché de bout en bout, sans dupliquer les tests de fabrique.
const run = (...argv: string[]) => {
  const lines: string[] = [];
  const code = runCli(argv, createModulesApplicationService(), (line) => lines.push(line));
  return { code, output: lines.join('\n') };
};

describe('CLI', () => {
  it('liste les modules du catalogue', () => {
    const { code, output } = run('list');

    expect(code).toBe(0);
    expect(output).toContain('fastify-server');
    expect(output).toContain('vue-app');
  });

  it('applique un module dans un dossier', () => {
    const projectFolder = tmpDirForTest();

    const { code } = run('apply', 'init', '--project-folder', projectFolder);

    expect(code).toBe(0);
    expect(existsSync(join(projectFolder, 'package.json'))).toBe(true);
  });

  it('explique ce qui manque quand l’ordre n’est pas respecté', () => {
    const { code, output } = run('apply', 'vitest', '--project-folder', tmpDirForTest());

    expect(code).toBe(1);
    expect(output).toBe('Erreur : Le module vitest requiert d\'abord : typescript');
  });
});
