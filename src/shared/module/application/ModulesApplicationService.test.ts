import { existsSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { databaseModuleResources } from '../../test/databaseModuleResources.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import { from, moduleBuilder } from '../domain/CraftModule.js';
import { ModulePropertiesDefinition } from '../domain/ModuleProperties.js';
import {
  DuplicateDestinationError,
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

  it('refuses a module whose dependencies are not applied', () => {
    const service = createModulesApplicationService({ clock });

    expect(() => service.apply('typescript', { projectFolder: tmpDirForTest() })).toThrow(
      MissingModuleDependenciesError,
    );
  });

  it('refuses an unknown module or a missing mandatory property', () => {
    const service = createModulesApplicationService({ clock });

    expect(() => service.apply('nope', { projectFolder: tmpDirForTest() })).toThrow(UnknownModuleError);
    expect(() => service.apply('init', {})).toThrow(MissingPropertyError);
  });

  it('records the history and merges package.json without losing existing content', () => {
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

  it('is idempotent: applying a module again duplicates neither history nor dependencies', () => {
    const service = createModulesApplicationService({ clock });
    const projectFolder = tmpDirForTest();

    service.apply('init', { projectFolder });
    service.apply('init', { projectFolder });

    expect(readJson(projectFolder, '.crafttype/modules/history.json').modules).toHaveLength(1);
  });

  it('applies an identical module again without touching the files', () => {
    const service = createModulesApplicationService({ clock });
    const projectFolder = tmpDirForTest();
    service.apply('init', { projectFolder });
    const readme = join(projectFolder, 'README.md');
    utimesSync(readme, 1_000, 1_000);

    service.apply('init', { projectFolder });

    expect(statSync(readme).mtimeMs).toBe(1_000_000);
  });

  describe('properties shared between modules', () => {
    it('reuses the server port for the Vue application proxy', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder });
      service.apply('typescript', { projectFolder });
      service.apply('vitest', { projectFolder });

      service.apply('fastify-server', { projectFolder, serverPort: 4000 });
      service.apply('vue-app', { projectFolder });

      expect(readFileSync(join(projectFolder, 'vite.config.ts'), 'utf8')).toContain('http://127.0.0.1:4000');
    });

    it('reuses the project name set by init', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      service.apply('typescript', { projectFolder });

      service.apply('vue-app', { projectFolder });

      expect(readFileSync(join(projectFolder, 'src/webapp/index.html'), 'utf8')).toContain('<title>shop</title>');
    });

    it('records in the history only the properties the module declares', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      service.apply('typescript', { projectFolder });

      const { modules } = readJson(projectFolder, '.crafttype/modules/history.json');

      expect(modules[0].properties).toEqual({ projectName: 'shop' });
      expect(modules[1].properties).toEqual({});
    });

    it('refuses a property that is invalid or that the module does not support', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder });
      service.apply('typescript', { projectFolder });
      service.apply('vitest', { projectFolder });

      expect(() => service.apply('fastify-server', { projectFolder, serverPort: 'abc' })).toThrow(InvalidPropertyError);
      expect(() => service.apply('typescript', { projectFolder, serverPort: 4000 })).toThrow(InvalidPropertyError);
      expect(() => service.apply('init', { projectFolder: tmpDirForTest(), projectName: 'My App' })).toThrow(
        InvalidPropertyError,
      );
    });
  });

  describe('existing files', () => {
    const initialized = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      return { service, projectFolder };
    };

    it('refuses to overwrite a modified file and writes nothing', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'README.md'), 'my readme');
      writeFileSync(join(projectFolder, '.gitignore'), 'custom');

      expect(() => service.apply('init', { projectFolder })).toThrow(ModuleConflictError);

      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('my readme');
      expect(readFileSync(join(projectFolder, '.gitignore'), 'utf8')).toBe('custom');
      expect(existsSync(join(projectFolder, '.editorconfig'))).toBe(true);
    });

    it('lists all conflicting items, files as well as package.json entries', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'README.md'), 'my readme');

      const error = (() => {
        try {
          service.apply('init', { projectFolder, projectName: 'other' });
        } catch (caught) {
          return caught as ModuleConflictError;
        }
        throw new Error('an error was expected');
      })();

      expect(error.conflicts).toEqual(
        expect.arrayContaining([
          'README.md',
          expect.stringContaining('package.json: name (existing: "shop", module: "other")'),
        ]),
      );
    });

    it('refuses to change a script or a version already present in package.json', () => {
      const { service, projectFolder } = initialized();
      service.apply('typescript', { projectFolder });
      const packageJson = readJson(projectFolder, 'package.json');
      packageJson.scripts.typecheck = 'tsc -b';
      packageJson.devDependencies.typescript = '^6.0.0';
      writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));

      expect(() => service.apply('typescript', { projectFolder })).toThrow(
        /scripts\.typecheck.*devDependencies\.typescript/s,
      );
      expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('^6.0.0');
    });

    it('does not record the module in the history when it is refused', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'tsconfig.json'), '{}');

      expect(() => service.apply('typescript', { projectFolder })).toThrow(ModuleConflictError);

      expect(
        readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug),
      ).toEqual(['init']);
    });

    it('replaces the conflicting items with force', () => {
      const { service, projectFolder } = initialized();
      writeFileSync(join(projectFolder, 'README.md'), 'my readme');

      service.apply('init', { projectFolder, projectName: 'other' }, { onConflict: 'overwrite' });

      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toContain('# other');
      expect(readJson(projectFolder, 'package.json').name).toBe('other');
    });

    it('refuses first to overwrite a file that existed before the first module', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      writeFileSync(join(projectFolder, 'README.md'), 'existing');

      expect(() => service.apply('init', { projectFolder })).toThrow(ModuleConflictError);
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
    });
  });

  describe('conflict policy', () => {
    const initialized = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder, projectName: 'shop' });
      service.apply('typescript', { projectFolder });
      return { service, projectFolder };
    };
    const edit = (projectFolder: string) => {
      writeFileSync(join(projectFolder, 'tsconfig.json'), '{ "custom": true }');
      const packageJson = readJson(projectFolder, 'package.json');
      packageJson.scripts.typecheck = 'tsc -b';
      delete packageJson.devDependencies['@types/node'];
      writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));
    };

    it('counts what is created when the project is new, then everything unchanged when applying again', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();

      const first = service.apply('init', { projectFolder, projectName: 'shop' });
      const second = service.apply('init', { projectFolder, projectName: 'shop' });

      expect(first.report).toMatchObject({ replaced: 0, unchanged: 0, skipped: 0, conflicts: 0 });
      expect(first.report.created).toBeGreaterThan(0);
      expect(second.report).toEqual({
        created: 0,
        edited: 0,
        replaced: 0,
        unchanged: first.report.created,
        kept: 0,
        skipped: 0,
        conflicts: 0,
      });
    });

    it('keeps the existing items and applies the rest with skip', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      const { report, changes } = service.apply('typescript', { projectFolder }, { onConflict: 'skip' });

      expect(readFileSync(join(projectFolder, 'tsconfig.json'), 'utf8')).toBe('{ "custom": true }');
      const packageJson = readJson(projectFolder, 'package.json');
      expect(packageJson.scripts.typecheck).toBe('tsc -b');
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
      expect(report).toMatchObject({ created: 1, skipped: 2, replaced: 0, conflicts: 0 });
      expect(changes.filter(({ decision }) => decision === 'skip').map(({ target }) => target)).toEqual([
        'tsconfig.json',
        'typecheck',
      ]);
    });

    it('records the module in the history with skip', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      service.apply('typescript', { projectFolder }, { onConflict: 'skip' });

      expect(
        readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug),
      ).toEqual(['init', 'typescript']);
    });

    it('replaces and counts the replacements with overwrite', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      const { report } = service.apply('typescript', { projectFolder }, { onConflict: 'overwrite' });

      expect(report).toMatchObject({ created: 1, replaced: 2, skipped: 0 });
      expect(readJson(projectFolder, 'package.json').scripts.typecheck).toBe('tsc --noEmit');
    });

    it('simulates without writing or recording anything, even when there are conflicts', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);
      const before = readFileSync(join(projectFolder, 'package.json'), 'utf8');
      const historyBefore = readFileSync(join(projectFolder, '.crafttype/modules/history.json'), 'utf8');

      const { dryRun, report, changes } = service.apply('typescript', { projectFolder }, { dryRun: true });

      expect(dryRun).toBe(true);
      expect(report).toMatchObject({ created: 1, conflicts: 2 });
      expect(changes.find(({ target }) => target === 'tsconfig.json')?.decision).toBe('conflict');
      expect(readFileSync(join(projectFolder, 'package.json'), 'utf8')).toBe(before);
      expect(readFileSync(join(projectFolder, 'tsconfig.json'), 'utf8')).toBe('{ "custom": true }');
      expect(readFileSync(join(projectFolder, '.crafttype/modules/history.json'), 'utf8')).toBe(historyBefore);
    });

    describe('dependency versions', () => {
      const setTypescriptVersion = (projectFolder: string, version: string) => {
        const packageJson = readJson(projectFolder, 'package.json');
        packageJson.devDependencies.typescript = version;
        writeFileSync(join(projectFolder, 'package.json'), JSON.stringify(packageJson));
      };

      it('keeps a version newer than the catalog without seeing a conflict', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '99.0.0');

        const { report } = service.apply('typescript', { projectFolder });

        expect(report).toMatchObject({ kept: 1, conflicts: 0 });
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('99.0.0');
      });

      it('never moves a version backwards, even with overwrite', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '99.0.0');

        const { report } = service.apply('typescript', { projectFolder }, { onConflict: 'overwrite' });

        expect(report).toMatchObject({ kept: 1, replaced: 0 });
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('99.0.0');
      });

      it('keeps a range that accepts the catalog version', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '>=5');

        expect(service.apply('typescript', { projectFolder }).report.kept).toBe(1);
      });

      it('refuses a version older than the catalog, and replaces it with overwrite', () => {
        const { service, projectFolder } = initialized();
        setTypescriptVersion(projectFolder, '4.0.0');

        expect(() => service.apply('typescript', { projectFolder })).toThrow(/devDependencies\.typescript/);

        service.apply('typescript', { projectFolder }, { onConflict: 'overwrite' });
        expect(readJson(projectFolder, 'package.json').devDependencies.typescript).toBe('7.0.2');
      });

      it('applies the rest of the module when only a newer version differs', () => {
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

    it('simulates what each policy would do', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      const decisions = (onConflict: 'fail' | 'overwrite' | 'skip') =>
        service
          .apply('typescript', { projectFolder }, { dryRun: true, onConflict })
          .changes.map(({ decision }) => decision);

      expect(decisions('fail')).toContain('conflict');
      expect(decisions('overwrite')).toContain('overwrite');
      expect(decisions('skip')).toContain('skip');
    });

    it('simulates on a folder that does not exist yet without creating it', () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = join(tmpDirForTest(), 'new');

      const { report } = service.apply('init', { projectFolder }, { dryRun: true });

      expect(report.created).toBeGreaterThan(0);
      expect(existsSync(projectFolder)).toBe(false);
    });

    it('always refuses by default and without writing anything', () => {
      const { service, projectFolder } = initialized();
      edit(projectFolder);

      expect(() => service.apply('typescript', { projectFolder })).toThrow(ModuleConflictError);
    });
  });

  describe('unreadable project files', () => {
    const withTypescriptPrerequisite = () => {
      const service = createModulesApplicationService({ clock });
      const projectFolder = tmpDirForTest();
      service.apply('init', { projectFolder });
      service.apply('typescript', { projectFolder });
      return { service, projectFolder };
    };

    it('reports an invalid package.json as a business error', () => {
      const { service, projectFolder } = withTypescriptPrerequisite();
      writeFileSync(join(projectFolder, 'package.json'), '{ oops');

      expect(() => service.apply('vitest', { projectFolder })).toThrow(InvalidProjectFileError);
      expect(() => service.apply('vitest', { projectFolder })).toThrow(/package\.json/);
    });

    it('refuses a package.json that is not an object', () => {
      const { service, projectFolder } = withTypescriptPrerequisite();
      writeFileSync(join(projectFolder, 'package.json'), '[]');

      expect(() => service.apply('vitest', { projectFolder })).toThrow(InvalidProjectFileError);
    });

    it.each([
      ['invalid JSON', '{ oops'],
      ['no module list', '{}'],
      ['malformed modules', '{"modules":[{"slug":1}]}'],
    ])('reports a history with %s as a business error', (_name, content) => {
      const { service, projectFolder } = withTypescriptPrerequisite();
      writeFileSync(join(projectFolder, '.crafttype/modules/history.json'), content);

      expect(() => service.apply('vitest', { projectFolder })).toThrow(InvalidProjectFileError);
    });
  });
  describe('properties specific to a module', () => {
    const database = () => createModulesApplicationService({ clock, extraResources: databaseModuleResources });

    it('passes the typed values to the module factory', () => {
      const service = database();
      const projectFolder = tmpDirForTest();

      service.apply('database', { projectFolder, databaseName: 'shop', poolSize: '25', migrations: false });

      const { scripts } = readJson(projectFolder, 'package.json');
      expect(scripts).toEqual({ 'db:info': 'echo shop:25' });
    });

    it('records these values in the history and gives them back to the following modules', () => {
      const service = database();
      const projectFolder = tmpDirForTest();
      service.apply('database', { projectFolder, databaseName: 'shop' });

      service.apply('database-seed', { projectFolder });

      const { modules } = readJson(projectFolder, '.crafttype/modules/history.json');
      expect(modules[0].properties).toEqual({ databaseName: 'shop', poolSize: 10, migrations: true });
      expect(modules[1].properties).toEqual({ databaseName: 'shop' });
      expect(readJson(projectFolder, 'package.json').scripts['db:seed']).toBe('echo seed shop');
    });

    it('lets an explicit value win over the one from the history', () => {
      const service = database();
      const projectFolder = tmpDirForTest();
      service.apply('database', { projectFolder, databaseName: 'shop' });

      service.apply('database-seed', { projectFolder, databaseName: 'other' }, { onConflict: 'overwrite' });

      expect(readJson(projectFolder, 'package.json').scripts['db:seed']).toBe('echo seed other');
    });

    it('refuses a mandatory property that is missing, invalid, or not declared by the module', () => {
      const service = database();
      const projectFolder = tmpDirForTest();

      expect(() => service.apply('database', { projectFolder })).toThrow(MissingPropertyError);
      expect(() => service.apply('database', { projectFolder, databaseName: 'shop', poolSize: 0 })).toThrow(
        InvalidPropertyError,
      );
      expect(() => service.apply('database', { projectFolder, databaseName: 'shop', serverPort: 4000 })).toThrow(
        InvalidPropertyError,
      );
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
    });
  });
  describe('modification of existing files', () => {
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

    it('inserts the code before the needles and keeps what the team added', () => {
      const { service, projectFolder } = withVueApp();
      writeFileSync(
        join(projectFolder, MAIN),
        `${readFileSync(join(projectFolder, MAIN), 'utf8')}console.info('custom');\n`,
      );

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
        "console.info('custom');",
        '',
      ]);
      expect(readJson(projectFolder, 'package.json').dependencies).toHaveProperty('pinia');
    });

    it('changes nothing more when applying the module again', () => {
      const { service, projectFolder } = withVueApp();
      service.apply('pinia', { projectFolder });
      const before = readFileSync(join(projectFolder, MAIN), 'utf8');

      const { report } = service.apply('pinia', { projectFolder });

      expect(report).toMatchObject({ created: 0, edited: 0, unchanged: 2 });
      expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toBe(before);
    });

    it('applies the modification whatever the conflict policy', () => {
      for (const onConflict of ['fail', 'skip', 'overwrite'] as const) {
        const { service, projectFolder } = withVueApp();

        expect(service.apply('pinia', { projectFolder }, { onConflict }).report.edited).toBe(1);
        expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toContain('app.use(createPinia());');
      }
    });

    it('shows the modification in a dry run without touching the file or the history', () => {
      const { service, projectFolder } = withVueApp();
      const before = readFileSync(join(projectFolder, MAIN), 'utf8');

      const { changes } = service.apply('pinia', { projectFolder }, { dryRun: true });

      expect(changes.find(({ target }) => target === MAIN)).toMatchObject({ kind: 'edit', decision: 'edit' });
      expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toBe(before);
      expect(
        readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug),
      ).not.toContain('pinia');
    });

    it('writes nothing when a needle has been removed', () => {
      const { service, projectFolder } = withVueApp();
      const withoutNeedle = readFileSync(join(projectFolder, MAIN), 'utf8').replace(
        '// crafttype-needle-main-plugins\n',
        '',
      );
      writeFileSync(join(projectFolder, MAIN), withoutNeedle);
      const packageJson = readFileSync(join(projectFolder, 'package.json'), 'utf8');

      expect(() => service.apply('pinia', { projectFolder })).toThrow(NeedleError);
      expect(() => service.apply('pinia', { projectFolder }, { dryRun: true })).toThrow(NeedleError);

      expect(readFileSync(join(projectFolder, MAIN), 'utf8')).toBe(withoutNeedle);
      expect(readFileSync(join(projectFolder, 'package.json'), 'utf8')).toBe(packageJson);
      expect(
        readJson(projectFolder, '.crafttype/modules/history.json').modules.map(({ slug }: { slug: string }) => slug),
      ).not.toContain('pinia');
    });

    it.each([
      ['pinia then vue-router', ['pinia', 'vue-router']],
      ['vue-router then pinia', ['vue-router', 'pinia']],
    ])('combines two modules on the same file: %s', (_, modules) => {
      const { service, projectFolder } = withVueApp();

      for (const module of modules) service.apply(module, { projectFolder });
      for (const module of modules) service.apply(module, { projectFolder });

      const main = lines(projectFolder);
      for (const line of [
        "import { createPinia } from 'pinia';",
        "import { router } from './router.js';",
        'app.use(createPinia());',
        'app.use(router);',
      ]) {
        expect(
          main.filter((candidate) => candidate === line),
          line,
        ).toHaveLength(1);
      }
      expect(main.indexOf('// crafttype-needle-main-imports')).toBeGreaterThan(
        main.indexOf("import { router } from './router.js';"),
      );
      expect(main.indexOf('// crafttype-needle-main-plugins')).toBeGreaterThan(main.indexOf('app.use(router);'));
      expect(readFileSync(join(projectFolder, 'src/webapp/App.vue'), 'utf8')).toContain(
        '    <RouterView />\n    <!-- crafttype-needle-app-template -->',
      );
    });

    describe('server modules', () => {
      const withServer = (serverPort?: number) => {
        const service = createModulesApplicationService({ clock });
        const projectFolder = tmpDirForTest();
        for (const module of ['init', 'typescript', 'vitest']) service.apply(module, { projectFolder });
        service.apply('fastify-server', serverPort === undefined ? { projectFolder } : { projectFolder, serverPort });
        return { service, projectFolder };
      };
      const read = (folder: string, path: string) => readFileSync(join(folder, path), 'utf8');

      it.each([
        ['config then logs', ['config', 'logs']],
        ['logs then config', ['logs', 'config']],
      ])('config and logs each modify their file: %s', (_, modules) => {
        const { service, projectFolder } = withServer();

        for (const module of modules) service.apply(module, { projectFolder });
        for (const module of modules)
          expect(service.apply(module, { projectFolder }).report).toMatchObject({
            created: 0,
            edited: 0,
            conflicts: 0,
          });

        expect(read(projectFolder, 'src/server/main.ts')).toContain(
          '  Object.assign(settings, loadConfig(settings));\n  // crafttype-needle-main-settings',
        );
        expect(read(projectFolder, 'src/server/app.ts')).toContain(
          '  serverOptions.genReqId = genReqId;\n  // crafttype-needle-app-server-options',
        );
      });

      it('config has no port of its own: it completes the one from fastify-server', () => {
        const { service, projectFolder } = withServer(4321);

        service.apply('config', { projectFolder });

        expect(read(projectFolder, 'src/server/main.ts')).toContain('port: 4321');
        expect(read(projectFolder, 'src/server/config.ts')).not.toContain('4321');
        expect(() => service.apply('config', { projectFolder, serverPort: 5000 })).toThrow(InvalidPropertyError);
        expect(readJson(projectFolder, '.crafttype/modules/history.json').modules.at(-1).properties).toEqual({});
      });

      it('logs records no property and adds no dependency', () => {
        const { service, projectFolder } = withServer();
        const before = readJson(projectFolder, 'package.json');

        service.apply('logs', { projectFolder });

        expect(readJson(projectFolder, 'package.json')).toEqual(before);
        expect(readJson(projectFolder, '.crafttype/modules/history.json').modules.at(-1).properties).toEqual({});
      });

      it('require fastify-server', () => {
        const service = createModulesApplicationService({ clock });
        const projectFolder = tmpDirForTest();
        service.apply('init', { projectFolder });

        expect(() => service.apply('config', { projectFolder })).toThrow(MissingModuleDependenciesError);
        expect(() => service.apply('logs', { projectFolder })).toThrow(MissingModuleDependenciesError);
      });
    });

    it('explains that the file to modify cannot be found', () => {
      const { service, projectFolder } = withVueApp();
      rmSync(join(projectFolder, MAIN));

      expect(() => service.apply('pinia', { projectFolder })).toThrow(/src\/webapp\/main\.ts: file not found/);
    });
  });

  describe('destinations of a module', () => {
    it('refuses a module that declares the same file under two spellings, and writes nothing', () => {
      const projectFolder = tmpDirForTest();
      const module = moduleBuilder(ModulePropertiesDefinition.builder().build().resolve({ projectFolder }))
        .addFile(from('init').template('editorconfig'), 'src/a.txt')
        .addFile(from('init').template('editorconfig'), 'src/x/../a.txt')
        .build();

      expect(() => createModulesApplicationService().applyModule(module)).toThrow(DuplicateDestinationError);
      expect(existsSync(join(projectFolder, 'src'))).toBe(false);
    });
  });
});
