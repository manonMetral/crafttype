import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../composition.js';
import { runCli } from '../../shared/module/infrastructure/primary/cli.js';
import { databaseModuleResources } from '../../shared/test/databaseModuleResources.js';
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

    it('conserve une version plus récente et le dit, sans conflit', () => {
      const projectFolder = tmpDirForTest();
      for (const module of ['init', 'typescript']) {
        run('apply', module, '--project-folder', projectFolder);
      }
      const packageJson = JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8'));
      packageJson.devDependencies.typescript = '99.0.0';
      writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));

      const dryRun = run('apply', 'typescript', '--project-folder', projectFolder, '--dry-run');
      const real = run('apply', 'typescript', '--project-folder', projectFolder, '--force');

      expect(dryRun.code).toBe(0);
      expect(dryRun.output).toMatch(/conserver\s+package\.json : devDependencies\.typescript \(existant : "99\.0\.0"/);
      expect(real.code).toBe(0);
      expect(real.output).toContain('versions conservées : 1');
      expect(JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8')).devDependencies.typescript).toBe('99.0.0');
    });
  });
  describe('propriétés propres à un module', () => {
    const runDatabase = (...argv: string[]) => {
      const lines: string[] = [];
      const code = runCli(argv, createModulesApplicationService({ extraResources: databaseModuleResources }), (line) => lines.push(line));
      return { code, output: lines.join('\n') };
    };

    it('dérive les options de la définition du module', () => {
      const projectFolder = tmpDirForTest();

      const { code } = runDatabase('apply', 'database', '--project-folder', projectFolder, '--database-name', 'shop', '--pool-size', '25', '--no-migrations');

      expect(code).toBe(0);
      const { scripts } = JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8'));
      expect(scripts).toEqual({ 'db:info': 'echo shop:25' });
    });

    it('active une propriété booléenne avec son option seule', () => {
      const projectFolder = tmpDirForTest();

      runDatabase('apply', 'database', '--project-folder', projectFolder, '--database-name', 'shop', '--migrations');

      expect(JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8')).scripts['db:migrate']).toBe('echo migrate');
    });

    it('nomme l’option manquante ou invalide avec son flag', () => {
      const projectFolder = tmpDirForTest();

      expect(runDatabase('apply', 'database', '--project-folder', projectFolder).output).toBe('Erreur : Option obligatoire manquante : --database-name');
      expect(runDatabase('apply', 'database', '--project-folder', projectFolder, '--database-name', 'shop', '--pool-size', '0').output).toBe(
        'Erreur : Option --pool-size invalide : la taille doit valoir au moins 1',
      );
    });

    it('refuse l’option d’un autre module', () => {
      const { code, output } = runDatabase('apply', 'database-seed', '--project-folder', tmpDirForTest(), '--pool-size', '5');

      expect(code).toBe(1);
      expect(output).toContain('Erreur : option inconnue : --pool-size');
    });

    it('décrit les options du module avec --help, sans rien écrire', () => {
      const projectFolder = tmpDirForTest();

      const { code, output } = runDatabase('apply', 'database', '--help', '--project-folder', projectFolder);

      expect(code).toBe(0);
      expect(output).toBe(
        [
          'Module database : Configure la base de données',
          'Options :',
          '  --project-folder <texte>  (obligatoire) Dossier du projet à générer ou à enrichir',
          '  --database-name <texte>   (obligatoire) Nom de la base',
          '  --pool-size <nombre>      (défaut : 10) Taille du pool de connexions',
          '  --migrations              (défaut : true) Active les migrations',
        ].join('\n'),
      );
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
    });
  });

  it('refuse un module inconnu avant de lire ses options', () => {
    const { code, output } = run('apply', 'nope', '--project-folder', tmpDirForTest());

    expect(code).toBe(1);
    expect(output).toBe('Erreur : Module inconnu : nope');
  });

  it('demande le module juste après apply', () => {
    const { code, output } = run('apply', '--project-folder', tmpDirForTest(), 'init');

    expect(code).toBe(1);
    expect(output).toContain('Usage :');
  });
});
