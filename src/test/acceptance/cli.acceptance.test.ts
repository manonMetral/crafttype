import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

  it('nomme l’option manquante avec son flag', () => {
    const { code, output } = run('apply', 'init');

    expect(code).toBe(1);
    expect(output).toBe('Erreur : Option obligatoire manquante : --project-folder');
  });

  it('refuse un port invalide en citant l’option', () => {
    const projectFolder = tmpDirForTest();
    for (const module of ['init', 'typescript', 'vitest']) {
      run('apply', module, '--project-folder', projectFolder);
    }

    const { code, output } = run('apply', 'fastify-server', '--project-folder', projectFolder, '--server-port', 'abc');

    expect(code).toBe(1);
    expect(output).toContain('Erreur : Option --server-port invalide');
    expect(existsSync(join(projectFolder, 'src/server'))).toBe(false);
  });

  it('refuse un nom de projet invalide', () => {
    const { code, output } = run('apply', 'init', '--project-folder', tmpDirForTest(), '--project-name', 'Mon App');

    expect(code).toBe(1);
    expect(output).toContain('Erreur : Option --project-name invalide');
  });

  it('signale une option inconnue sans stack trace', () => {
    const { code, output } = run('apply', 'init', '--foo');

    expect(code).toBe(1);
    expect(output).toContain('Erreur : option inconnue : --foo');
    expect(output).toContain('Usage :');
  });

  it('refuse d’écraser un fichier modifié, sauf avec --force', () => {
    const projectFolder = tmpDirForTest();
    run('apply', 'init', '--project-folder', projectFolder);
    writeFileSync(join(projectFolder, 'README.md'), 'mon readme');

    const refused = run('apply', 'init', '--project-folder', projectFolder);

    expect(refused.code).toBe(1);
    expect(refused.output).toContain('README.md');
    expect(refused.output).toContain('--force');
    expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('mon readme');

    const forced = run('apply', 'init', '--project-folder', projectFolder, '--force');

    expect(forced.code).toBe(0);
    expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toContain('Projet généré avec crafttype');
  });

  it('signale un package.json invalide sans stack trace', () => {
    const projectFolder = tmpDirForTest();
    for (const module of ['init', 'typescript']) {
      run('apply', module, '--project-folder', projectFolder);
    }
    writeFileSync(join(projectFolder, 'package.json'), '{ oops');

    const { code, output } = run('apply', 'vitest', '--project-folder', projectFolder);

    expect(code).toBe(1);
    expect(output).toContain('Erreur : Fichier package.json invalide');
  });

  describe('conflits', () => {
    const initialized = () => {
      const projectFolder = tmpDirForTest();
      run('apply', 'init', '--project-folder', projectFolder);
      writeFileSync(join(projectFolder, 'README.md'), 'mon readme');
      return projectFolder;
    };

    it('garde l’existant avec --skip-conflicts et le dit', () => {
      const projectFolder = initialized();

      const { code, output } = run('apply', 'init', '--project-folder', projectFolder, '--project-name', 'autre', '--skip-conflicts');

      expect(code).toBe(0);
      expect(output).toContain('ignorés : ');
      expect(output).toContain('ignoré : README.md');
      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('mon readme');
    });

    it('indique les deux issues quand un conflit bloque', () => {
      const { code, output } = run('apply', 'init', '--project-folder', initialized());

      expect(code).toBe(1);
      expect(output).toContain('--skip-conflicts');
      expect(output).toContain('--force');
    });

    it('refuse --force avec --skip-conflicts', () => {
      const { code, output } = run('apply', 'init', '--project-folder', initialized(), '--force', '--skip-conflicts');

      expect(code).toBe(1);
      expect(output).toContain('--force et --skip-conflicts sont incompatibles');
    });

    it('simule sans écrire avec --dry-run', () => {
      const projectFolder = tmpDirForTest();

      const { code, output } = run('apply', 'init', '--project-folder', projectFolder, '--dry-run');

      expect(code).toBe(0);
      expect(output).toContain('Simulation du module init');
      expect(output).toMatch(/créer\s+README\.md/);
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
      expect(existsSync(join(projectFolder, '.crafttype'))).toBe(false);
    });

    it('signale les conflits en simulation avec un code de sortie 1', () => {
      const projectFolder = initialized();

      const { code, output } = run('apply', 'init', '--project-folder', projectFolder, '--dry-run');

      expect(code).toBe(1);
      expect(output).toMatch(/conflit\s+README\.md/);
      expect(output).toContain('--skip-conflicts');
      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('mon readme');
    });

    it('simule le remplacement avec --dry-run --force', () => {
      const { code, output } = run('apply', 'init', '--project-folder', initialized(), '--dry-run', '--force');

      expect(code).toBe(0);
      expect(output).toMatch(/remplacer\s+README\.md/);
    });
  });
});
