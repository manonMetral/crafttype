import { existsSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { databaseModuleResources } from '../../test/databaseModuleResources.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import {
  InvalidProjectFileError,
  InvalidPropertyError,
  MissingModuleDependenciesError,
  MissingPropertyError,
  ModuleConflictError,
  NeedleError,
  UnknownModuleError,
} from '../domain/errors.js';

const readJson = (folder: string, path: string) => JSON.parse(readFileSync(join(folder, path), 'utf8'));

describe('ModulesApplicationService', () => {
  const clock = () => new Date('2026-10-20T10:00:00Z');

  it('refuse un module dont les dépendances ne sont pas appliquées', () => {
    const service = createModulesApplicationService({ clock });

    expect(() => service.apply('typescript', { projectFolder: tmpDirForTest() })).toThrow(MissingModuleDependenciesError);
  });

  it('refuse un module inconnu ou une propriété obligatoire absente', () => {
    const service = createModulesApplicationService({ clock });

    expect(() => service.apply('nope', { projectFolder: tmpDirForTest() })).toThrow(UnknownModuleError);
    expect(() => service.apply('init', {})).toThrow(MissingPropertyError);
  });

  it('enregistre l’historique et fusionne le package.json sans perdre l’existant', () => {
    const service = createModulesApplicationService({ clock });
    const projectFolder = tmpDirForTest();

    service.apply('init', { projectFolder, projectName: 'shop' });
    service.apply('typescript', { projectFolder });
    service.apply('vitest', { projectFolder });

    const packageJson = readJson(projectFolder, 'package.json');
    expect(packageJson.name).toBe('shop');
    expect(Object.keys(packageJson.devDependencies)).toEqual(['@types/node', 'typescript', 'vitest']);
    expect(Object.keys(packageJson.scripts)).toEqual(['typecheck', 'test', 'test:watch']);

    const history = readJson(projectFolder, '.crafttype/modules/history.json');
    expect(history.modules.map(({ slug }: { slug: string }) => slug)).toEqual(['init', 'typescript', 'vitest']);
    expect(history.modules[0].appliedAt).toBe('2026-10-20T10:00:00.000Z');
  });

  it('est idempotent : réappliquer un module ne duplique ni historique ni dépendances', () => {
    const service = createModulesApplicationService({ clock });
    const projectFolder = tmpDirForTest();

    service.apply('init', { projectFolder });
    service.apply('init', { projectFolder });

    expect(readJson(projectFolder, '.crafttype/modules/history.json').modules).toHaveLength(1);
  });

  it('réapplique un module à l’identique sans toucher aux fichiers', () => {
    const service = createModulesApplicationService({ clock });
    const projectFolder = tmpDirForTest();
    service.apply('init', { projectFolder });
    const readme = join(projectFolder, 'README.md');
    utimesSync(readme, 1_000, 1_000);

    service.apply('init', { projectFolder });

    expect(statSync(readme).mtimeMs).toBe(1_000_000);
  });

  describe('propriétés partagées entre modules', () => {
    it('reprend le port du serveur pour le proxy de l’application Vue', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder });
      service.apply('typescript', { projectFolder });
      service.apply('vitest', { projectFolder });

      service.apply('fastify-server', { projectFolder, serverPort: 4000 });
      service.apply('vue-app', { projectFolder });

      expect(readFileSync(join(projectFolder, 'vite.config.ts'), 'utf8')).toContain('http://127.0.0.1:4000');
    });

    it('reprend le nom du projet posé par init', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      service.apply('typescript', { projectFolder });

      service.apply('vue-app', { projectFolder });

      expect(readFileSync(join(projectFolder, 'src/webapp/index.html'), 'utf8')).toContain('<title>shop</title>');
    });

    it('n’enregistre dans l’historique que les propriétés que le module déclare', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      service.apply('typescript', { projectFolder });

      const { modules } = readJson(projectFolder, '.crafttype/modules/history.json');

      expect(modules[0].properties).toEqual({ projectName: 'shop' });
      expect(modules[1].properties).toEqual({});
    });

    it('refuse une propriété invalide ou que le module ne prend pas en charge', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder });
      service.apply('typescript', { projectFolder });
      service.apply('vitest', { projectFolder });

      expect(() => service.apply('fastify-server', { projectFolder, serverPort: 'abc' })).toThrow(InvalidPropertyError);
      expect(() => service.apply('typescript', { projectFolder, serverPort: 4000 })).toThrow(InvalidPropertyError);
      expect(() => service.apply('init', { projectFolder: tmpDirForTest(), projectName: 'Mon App' })).toThrow(InvalidPropertyError);
    });
  });

  describe('fichiers existants', () => {
    const initialized = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      return { service, projectFolder };
    };

    it('refuse d’écraser un fichier modifié et n’écrit rien', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'README.md'), 'mon readme');
      writeFileSync(join(projectFolder, '.gitignore'), 'perso');

      expect(() => service.apply('init', { projectFolder })).toThrow(ModuleConflictError);

      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('mon readme');
      expect(readFileSync(join(projectFolder, '.gitignore'), 'utf8')).toBe('perso');
      expect(existsSync(join(projectFolder, '.editorconfig'))).toBe(true);
    });

    it('liste tous les éléments en conflit, fichiers comme entrées du package.json', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'README.md'), 'mon readme');

      const error = (() => {
        try {
          service.apply('init', { projectFolder, projectName: 'autre' });
        } catch (caught) {
          return caught as ModuleConflictError;
        }
        throw new Error('une erreur était attendue');
      })();

      expect(error.conflicts).toEqual(expect.arrayContaining(['README.md', expect.stringContaining('package.json : name (existant : "shop", module : "autre")')]));
    });

    it('refuse de changer un script ou une version déjà présents dans le package.json', () => {
      const { service, projectFolder } = initialized();
      service.apply('typescript', { projectFolder });
      const packageJson = readJson(projectFolder, 'package.json');
      packageJson.scripts.typecheck = 'tsc -b';
      packageJson.devDependencies.typescript = '^6.0.0';
      writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));

      expect(() => service.apply('typescript', { projectFolder })).toThrow(/scripts\.typecheck.*devDependencies\.typescript/s);
      expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('^6.0.0');
    });

    it('n’enregistre pas le module dans l’historique quand il est refusé', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'tsconfig.json'), '{}');

      expect(() => service.apply('typescript', { projectFolder })).toThrow(ModuleConflictError);

      expect(readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug)).toEqual(['init']);
    });

    it('remplace les éléments en conflit avec force', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'README.md'), 'mon readme');

      service.apply('init', { projectFolder, projectName: 'autre' }, { onConflict: 'overwrite' });

      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toContain('# autre');
      expect(readJson(projectFolder, 'package.json').name).toBe('autre');
    });

    it('refuse d’abord d’écraser un fichier qui existait avant le premier module', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      writeFileSync(join(projectFolder, 'README.md'), 'existant');

      expect(() => service.apply('init', { projectFolder })).toThrow(ModuleConflictError);
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
    });
  });

  describe('politique de conflit', () => {
    const initialized = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      service.apply('typescript', { projectFolder });
      return { service, projectFolder };
    };
    const edit = (projectFolder: string) => {
      writeFileSync(join(projectFolder, 'tsconfig.json'), '{ "perso": true }');
      const packageJson = readJson(projectFolder, 'package.json');
      packageJson.scripts.typecheck = 'tsc -b';
      delete packageJson.devDependencies['@types/node'];
      writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));
    };

    it('compte ce qui est créé quand le projet est neuf, puis tout inchangé en réappliquant', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();

      const first = service.apply('init', { projectFolder, projectName: 'shop' });
      const second = service.apply('init', { projectFolder, projectName: 'shop' });

      expect(first.report).toMatchObject({ replaced: 0, unchanged: 0, skipped: 0, conflicts: 0 });
      expect(first.report.created).toBeGreaterThan(0);
      expect(second.report).toEqual({ created: 0, edited: 0, replaced: 0, unchanged: first.report.created, kept: 0, skipped: 0, conflicts: 0 });
    });

    it('garde l’existant et applique le reste avec skip', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      const { report, changes } = service.apply('typescript', { projectFolder }, { onConflict: 'skip' });

      expect(readFileSync(join(projectFolder, 'tsconfig.json'), 'utf8')).toBe('{ "perso": true }');
      const packageJson = readJson(projectFolder, 'package.json');
      expect(packageJson.scripts.typecheck).toBe('tsc -b');
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
      expect(report).toMatchObject({ created: 1, skipped: 2, replaced: 0, conflicts: 0 });
      expect(changes.filter(({ decision }) => decision === 'skip').map(({ target }) => target)).toEqual(['tsconfig.json', 'typecheck']);
    });

    it('enregistre le module dans l’historique avec skip', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      service.apply('typescript', { projectFolder }, { onConflict: 'skip' });

      expect(readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug)).toEqual(['init', 'typescript']);
    });

    it('remplace et compte les remplacements avec overwrite', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      const { report } = service.apply('typescript', { projectFolder }, { onConflict: 'overwrite' });

      expect(report).toMatchObject({ created: 1, replaced: 2, skipped: 0 });
      expect(readJson(projectFolder, 'package.json').scripts.typecheck).toBe('tsc --noEmit');
    });

    it('simule sans rien écrire ni enregistrer, y compris en présence de conflits', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);
      const before = readFileSync(join(projectFolder, 'package.json'), 'utf8');
      const historyBefore = readFileSync(join(projectFolder, '.crafttype/modules/history.json'), 'utf8');

      const { dryRun, report, changes } = service.apply('typescript', { projectFolder }, { dryRun: true });

      expect(dryRun).toBe(true);
      expect(report).toMatchObject({ created: 1, conflicts: 2 });
      expect(changes.find(({ target }) => target === 'tsconfig.json')?.decision).toBe('conflict');
      expect(readFileSync(join(projectFolder, 'package.json'), 'utf8')).toBe(before);
      expect(readFileSync(join(projectFolder, 'tsconfig.json'), 'utf8')).toBe('{ "perso": true }');
      expect(readFileSync(join(projectFolder, '.crafttype/modules/history.json'), 'utf8')).toBe(historyBefore);
    });

    describe('versions de dépendances', () => {
      const setTypescriptVersion = (projectFolder: string, version: string) => {
        const packageJson = readJson(projectFolder, 'package.json');
        packageJson.devDependencies.typescript = version;
        writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));
      };

      it('garde une version plus récente que le catalogue sans y voir un conflit', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '99.0.0');

        const { report } = service.apply('typescript', { projectFolder });

        expect(report).toMatchObject({ kept: 1, conflicts: 0 });
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('99.0.0');
      });

      it('ne fait jamais reculer une version, même avec overwrite', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '99.0.0');

        const { report } = service.apply('typescript', { projectFolder }, { onConflict: 'overwrite' });

        expect(report).toMatchObject({ kept: 1, replaced: 0 });
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('99.0.0');
      });

      it('garde un intervalle qui accepte la version du catalogue', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '>=5');

        expect(service.apply('typescript', { projectFolder }).report.kept).toBe(1);
      });

      it('refuse une version plus ancienne que le catalogue, et la remplace avec overwrite', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '4.0.0');

        expect(() => service.apply('typescript', { projectFolder })).toThrow(/devDependencies\.typescript/);

        service.apply('typescript', { projectFolder }, { onConflict: 'overwrite' });
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('7.0.2');
      });

      it('applique le reste du module quand seule une version plus récente diffère', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '99.0.0');
        const packageJson = readJson(projectFolder, 'package.json');
        delete packageJson.devDependencies['@types/node'];
        writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));

        const { report } = service.apply('typescript', { projectFolder });

        expect(report).toMatchObject({ created: 1, kept: 1 });
        expect(readJson(projectFolder, 'package.json').devDependencies['@types/node']).toBeDefined();
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('99.0.0');
      });
    });

    it('simule ce que ferait chaque politique', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      const decisions = (onConflict: 'fail' | 'overwrite' | 'skip') =>
        service.apply('typescript', { projectFolder }, { dryRun: true, onConflict }).changes.map(({ decision }) => decision);

      expect(decisions('fail')).toContain('conflict');
      expect(decisions('overwrite')).toContain('overwrite');
      expect(decisions('skip')).toContain('skip');
    });

    it('simule sur un dossier qui n’existe pas encore sans le créer', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = join(tmpDirForTest(), 'nouveau');

      const { report } = service.apply('init', { projectFolder }, { dryRun: true });

      expect(report.created).toBeGreaterThan(0);
      expect(existsSync(projectFolder)).toBe(false);
    });

    it('refuse toujours par défaut et sans rien écrire', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      expect(() => service.apply('typescript', { projectFolder })).toThrow(ModuleConflictError);
    });
  });

  describe('fichiers du projet illisibles', () => {
    const withTypescriptPrerequisite = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder });
      service.apply('typescript', { projectFolder });
      return { service, projectFolder };
    };

    it('signale un package.json invalide comme une erreur métier', () => {
      const { service, projectFolder } = withTypescriptPrerequisite();
      writeFileSync(join(projectFolder, 'package.json'), '{ oops');

      expect(() => service.apply('vitest', { projectFolder })).toThrow(InvalidProjectFileError);
      expect(() => service.apply('vitest', { projectFolder })).toThrow(/package\.json/);
    });

    it('refuse un package.json qui n’est pas un objet', () => {
      const { service, projectFolder } = withTypescriptPrerequisite();
      writeFileSync(join(projectFolder, 'package.json'), '[]');

      expect(() => service.apply('vitest', { projectFolder })).toThrow(InvalidProjectFileError);
    });

    it.each([['JSON invalide', '{ oops'], ['sans liste de modules', '{}'], ['modules mal formés', '{"modules":[{"slug":1}]}']])(
      'signale un historique %s comme une erreur métier',
      (_name, content) => {
        const { service, projectFolder } = withTypescriptPrerequisite();
        writeFileSync(join(projectFolder, '.crafttype/modules/history.json'), content);

        expect(() => service.apply('vitest', { projectFolder })).toThrow(InvalidProjectFileError);
      },
    );
  });
  describe('propriétés propres à un module', () => {
    const database = () => createModulesApplicationService({ clock, extraResources: databaseModuleResources });

    it('transmet les valeurs typées à la fabrique du module', () => {
      const service = database();
      const projectFolder = tmpDirForTest();

      service.apply('database', { projectFolder, databaseName: 'shop', poolSize: '25', migrations: false });

      const { scripts } = readJson(projectFolder, 'package.json');
      expect(scripts).toEqual({ 'db:info': 'echo shop:25' });
    });

    it('enregistre ces valeurs dans l’historique et les redonne aux modules suivants', () => {
      const service = database();
      const projectFolder = tmpDirForTest();
      service.apply('database', { projectFolder, databaseName: 'shop' });

      service.apply('database-seed', { projectFolder });

      const { modules } = readJson(projectFolder, '.crafttype/modules/history.json');
      expect(modules[0].properties).toEqual({ databaseName: 'shop', poolSize: 10, migrations: true });
      expect(modules[1].properties).toEqual({ databaseName: 'shop' });
      expect(readJson(projectFolder, 'package.json').scripts['db:seed']).toBe('echo seed shop');
    });

    it('laisse une valeur explicite l’emporter sur celle de l’historique', () => {
      const service = database();
      const projectFolder = tmpDirForTest();
      service.apply('database', { projectFolder, databaseName: 'shop' });

      service.apply('database-seed', { projectFolder, databaseName: 'autre' }, { onConflict: 'overwrite' });

      expect(readJson(projectFolder, 'package.json').scripts['db:seed']).toBe('echo seed autre');
    });

    it('refuse une propriété obligatoire absente, invalide, ou que le module ne déclare pas', () => {
      const service = database();
      const projectFolder = tmpDirForTest();

      expect(() => service.apply('database', { projectFolder })).toThrow(MissingPropertyError);
      expect(() => service.apply('database', { projectFolder, databaseName: 'shop', poolSize: 0 })).toThrow(InvalidPropertyError);
      expect(() => service.apply('database', { projectFolder, databaseName: 'shop', serverPort: 4000 })).toThrow(InvalidPropertyError);
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
    });
  });
  describe('modification de fichiers existants', () => {
    const MAIN = 'src/webapp/main.ts';
    const withVueApp = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      for (const module of ['init', 'typescript', 'vue-app']) {
        service.apply(module, { projectFolder });
      }
      return { service, projectFolder };
    };
    const lines = (folder: string) => readFileSync(join(folder, MAIN), 'utf8').split('\n');

    it('insère le code avant les repères et garde ce que l’équipe a ajouté', () => {
      const { service, projectFolder } = withVueApp();
      writeFileSync(join(projectFolder, MAIN), `${readFileSync(join(projectFolder, MAIN), 'utf8')}console.info('perso');\n`);

      const { report } = service.apply('pinia', { projectFolder });

      expect(report).toMatchObject({ created: 1, edited: 1, conflicts: 0 });
      expect(lines(projectFolder)).toEqual([
        "import { createApp } from 'vue';",
        "import App from './App.vue';",
        "import { createPinia } from 'pinia';",
        '// crafttype-needle-main-imports',
        '',
        'const app = createApp(App);',
        'app.use(createPinia());',
        '// crafttype-needle-main-plugins',
        "app.mount('#app');",
        "console.info('perso');",
        '',
      ]);
      expect(readJson(projectFolder, 'package.json').dependencies).toHaveProperty('pinia');
    });

    it('ne change plus rien en réappliquant le module', () => {
      const { service, projectFolder } = withVueApp();
      service.apply('pinia', { projectFolder });
      const before = readFileSync(join(projectFolder, MAIN), 'utf8');

      const { report } = service.apply('pinia', { projectFolder });

      expect(report).toMatchObject({ created: 0, edited: 0, unchanged: 2 });
      expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toBe(before);
    });

    it('applique la modification quelle que soit la politique de conflit', () => {
      for (const onConflict of ['fail', 'skip', 'overwrite'] as const) {
        const { service, projectFolder } = withVueApp();

        expect(service.apply('pinia', { projectFolder }, { onConflict }).report.edited).toBe(1);
        expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toContain('app.use(createPinia());');
      }
    });

    it('montre la modification en simulation sans toucher au fichier ni à l’historique', () => {
      const { service, projectFolder } = withVueApp();
      const before = readFileSync(join(projectFolder, MAIN), 'utf8');

      const { changes } = service.apply('pinia', { projectFolder }, { dryRun: true });

      expect(changes.find(({ target }) => target === MAIN)).toMatchObject({ kind: 'edit', decision: 'edit' });
      expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toBe(before);
      expect(readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug)).not.toContain('pinia');
    });

    it('n’écrit rien quand un repère a été supprimé', () => {
      const { service, projectFolder } = withVueApp();
      const withoutNeedle = readFileSync(join(projectFolder, MAIN), 'utf8').replace('// crafttype-needle-main-plugins\n', '');
      writeFileSync(join(projectFolder, MAIN), withoutNeedle);
      const packageJson = readFileSync(join(projectFolder, 'package.json'), 'utf8');

      expect(() => service.apply('pinia', { projectFolder })).toThrow(NeedleError);
      expect(() => service.apply('pinia', { projectFolder }, { dryRun: true })).toThrow(NeedleError);

      expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toBe(withoutNeedle);
      expect(readFileSync(join(projectFolder, 'package.json'), 'utf8')).toBe(packageJson);
      expect(readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug)).not.toContain('pinia');
    });

    it.each([
      ['pinia puis vue-router', ['pinia', 'vue-router']],
      ['vue-router puis pinia', ['vue-router', 'pinia']],
    ])('combine deux modules sur le même fichier : %s', (_, modules) => {
      const { service, projectFolder } = withVueApp();

      for (const module of modules) service.apply(module, { projectFolder });
      for (const module of modules) service.apply(module, { projectFolder });

      const main = lines(projectFolder);
      for (const line of ["import { createPinia } from 'pinia';", "import { router } from './router.js';", 'app.use(createPinia());', 'app.use(router);']) {
        expect(main.filter((candidate) => candidate === line), line).toHaveLength(1);
      }
      expect(main.indexOf('// crafttype-needle-main-imports')).toBeGreaterThan(main.indexOf("import { router } from './router.js';"));
      expect(main.indexOf('// crafttype-needle-main-plugins')).toBeGreaterThan(main.indexOf('app.use(router);'));
      expect(readFileSync(join(projectFolder, 'src/webapp/App.vue'), 'utf8')).toContain('    <RouterView />\n    <!-- crafttype-needle-app-template -->');
    });

    it('explique que le fichier à modifier est introuvable', () => {
      const { service, projectFolder } = withVueApp();
      rmSync(join(projectFolder, MAIN));

      expect(() => service.apply('pinia', { projectFolder })).toThrow(/src\/webapp\/main\.ts : fichier introuvable/);
    });
  });
});
