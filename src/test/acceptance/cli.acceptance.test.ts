import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../composition.js';
import { runCli } from '../../shared/module/infrastructure/primary/cli.js';
import { databaseModuleResources } from '../../shared/test/databaseModuleResources.js';
import { tmpDirForTest } from '../../shared/test/ModuleAssertions.js';

// Equivalent of Seed4J's Cucumber tests: we go through the entry point (here the CLI) and only check
// that a module is wired end to end, without duplicating the factory tests.
const run = (...argv: string[]) => {
  const lines: string[] = [];
  const code = runCli(argv, createModulesApplicationService(), (line) => lines.push(line));
  return { code, output: lines.join('\n') };
};

describe('CLI', () => {
  it('lists the modules of the catalog', () => {
    const { code, output } = run('list');

    expect(code).toBe(0);
    expect(output).toContain('fastify-server');
    expect(output).toContain('vue-app');
  });

  it('applies a module in a folder', () => {
    const projectFolder = tmpDirForTest();

    const { code } = run('apply', 'init', '--project-folder', projectFolder);

    expect(code).toBe(0);
    expect(existsSync(join(projectFolder, 'package.json'))).toBe(true);
  });

  it('explains what is missing when the order is not respected', () => {
    const { code, output } = run('apply', 'vitest', '--project-folder', tmpDirForTest());

    expect(code).toBe(1);
    expect(output).toBe('Error: Module vitest requires first: typescript');
  });

  it('names the missing option with its flag', () => {
    const { code, output } = run('apply', 'init');

    expect(code).toBe(1);
    expect(output).toBe('Error: Missing required option: --project-folder');
  });

  it('refuses an invalid port by naming the option', () => {
    const projectFolder = tmpDirForTest();
    for (const module of ['init', 'typescript', 'vitest']) {
      run('apply', module, '--project-folder', projectFolder);
    }

    const { code, output } = run('apply', 'fastify-server', '--project-folder', projectFolder, '--server-port', 'abc');

    expect(code).toBe(1);
    expect(output).toContain('Error: Invalid option --server-port');
    expect(existsSync(join(projectFolder, 'src/server'))).toBe(false);
  });

  it('refuses an invalid project name', () => {
    const { code, output } = run('apply', 'init', '--project-folder', tmpDirForTest(), '--project-name', 'My App');

    expect(code).toBe(1);
    expect(output).toContain('Error: Invalid option --project-name');
  });

  describe('help', () => {
    it.each([[[]], [['help']], [['--help']], [['-h']], [['apply', '--help']], [['apply', '-h']]])(
      'prints the usage and succeeds with %j',
      (argv) => {
        const { code, output } = run(...argv);

        expect(code).toBe(0);
        expect(output).toContain('Usage:');
      },
    );

    it('prints the options of a module with -h as with --help', () => {
      const long = run('apply', 'fastify-server', '--help');
      const short = run('apply', 'fastify-server', '-h');

      expect(short).toEqual(long);
      expect(short.output).toContain('--server-port');
    });

    it('refuses an unknown command with the usage and an error code', () => {
      const { code, output } = run('unknown');

      expect(code).toBe(1);
      expect(output).toContain('Usage:');
    });

    it('refuses apply without a module', () => {
      expect(run('apply').code).toBe(1);
    });
  });

  it('reports an unknown option without a stack trace', () => {
    const { code, output } = run('apply', 'init', '--foo');

    expect(code).toBe(1);
    expect(output).toContain('Error: unknown option: --foo');
    expect(output).toContain('Usage:');
  });

  it('reports an option without a value without a stack trace', () => {
    const { code, output } = run('apply', 'init', '--project-folder');

    expect(code).toBe(1);
    expect(output).toContain('Error: missing or invalid value for option --project-folder');
    expect(output).toContain('Usage:');
  });

  it('reports an extra argument with the first line of the error', () => {
    const { code, output } = run('apply', 'init', 'extra', '--project-folder', tmpDirForTest());

    expect(code).toBe(1);
    expect(output).toMatch(/^Error: /);
    expect(output).toContain('Usage:');
  });

  it('refuses to overwrite a modified file, except with --force', () => {
    const projectFolder = tmpDirForTest();
    run('apply', 'init', '--project-folder', projectFolder);
    writeFileSync(join(projectFolder, 'README.md'), 'my readme');

    const refused = run('apply', 'init', '--project-folder', projectFolder);

    expect(refused.code).toBe(1);
    expect(refused.output).toContain('README.md');
    expect(refused.output).toContain('--force');
    expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('my readme');

    const forced = run('apply', 'init', '--project-folder', projectFolder, '--force');

    expect(forced.code).toBe(0);
    expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toContain('Project generated with crafttype');
  });

  it('reports an invalid package.json without a stack trace', () => {
    const projectFolder = tmpDirForTest();
    for (const module of ['init', 'typescript']) {
      run('apply', module, '--project-folder', projectFolder);
    }
    writeFileSync(join(projectFolder, 'package.json'), '{ oops');

    const { code, output } = run('apply', 'vitest', '--project-folder', projectFolder);

    expect(code).toBe(1);
    expect(output).toContain('Error: Invalid file package.json');
  });

  describe('conflicts', () => {
    const initialized = () => {
      const projectFolder = tmpDirForTest();
      run('apply', 'init', '--project-folder', projectFolder);
      writeFileSync(join(projectFolder, 'README.md'), 'my readme');
      return projectFolder;
    };

    it('keeps the existing items with --skip-conflicts and says so', () => {
      const projectFolder = initialized();

      const { code, output } = run(
        'apply',
        'init',
        '--project-folder',
        projectFolder,
        '--project-name',
        'other',
        '--skip-conflicts',
      );

      expect(code).toBe(0);
      expect(output).toContain('skipped: ');
      expect(output).toContain('skipped: README.md');
      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('my readme');
    });

    it('indicates both ways out when a conflict blocks', () => {
      const { code, output } = run('apply', 'init', '--project-folder', initialized());

      expect(code).toBe(1);
      expect(output).toContain('--skip-conflicts');
      expect(output).toContain('--force');
    });

    it('refuses --force with --skip-conflicts', () => {
      const { code, output } = run('apply', 'init', '--project-folder', initialized(), '--force', '--skip-conflicts');

      expect(code).toBe(1);
      expect(output).toContain('--force and --skip-conflicts are incompatible');
    });

    it('simulates without writing with --dry-run', () => {
      const projectFolder = tmpDirForTest();

      const { code, output } = run('apply', 'init', '--project-folder', projectFolder, '--dry-run');

      expect(code).toBe(0);
      expect(output).toContain('Dry run of module init');
      expect(output).toMatch(/create\s+README\.md/);
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
      expect(existsSync(join(projectFolder, '.crafttype'))).toBe(false);
    });

    it('reports the conflicts in a dry run with exit code 1', () => {
      const projectFolder = initialized();

      const { code, output } = run('apply', 'init', '--project-folder', projectFolder, '--dry-run');

      expect(code).toBe(1);
      expect(output).toMatch(/conflict\s+README\.md/);
      expect(output).toContain('--skip-conflicts');
      expect(readFileSync(join(projectFolder, 'README.md'), 'utf8')).toBe('my readme');
    });

    it('simulates the replacement with --dry-run --force', () => {
      const { code, output } = run('apply', 'init', '--project-folder', initialized(), '--dry-run', '--force');

      expect(code).toBe(0);
      expect(output).toMatch(/replace\s+README\.md/);
    });

    it('keeps a newer version and says so, without a conflict', () => {
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
      expect(dryRun.output).toMatch(/keep\s+package\.json: devDependencies\.typescript \(existing: "99\.0\.0"/);
      expect(real.code).toBe(0);
      expect(real.output).toContain('kept versions: 1');
      expect(JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8')).devDependencies.typescript).toBe(
        '99.0.0',
      );
    });
  });
  describe('properties specific to a module', () => {
    const runDatabase = (...argv: string[]) => {
      const lines: string[] = [];
      const code = runCli(argv, createModulesApplicationService({ extraResources: databaseModuleResources }), (line) =>
        lines.push(line),
      );
      return { code, output: lines.join('\n') };
    };

    it('derives the options from the module definition', () => {
      const projectFolder = tmpDirForTest();

      const { code } = runDatabase(
        'apply',
        'database',
        '--project-folder',
        projectFolder,
        '--database-name',
        'shop',
        '--pool-size',
        '25',
        '--no-migrations',
      );

      expect(code).toBe(0);
      const { scripts } = JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8'));
      expect(scripts).toEqual({ 'db:info': 'echo shop:25' });
    });

    it('enables a boolean property with its option alone', () => {
      const projectFolder = tmpDirForTest();

      runDatabase('apply', 'database', '--project-folder', projectFolder, '--database-name', 'shop', '--migrations');

      expect(JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8')).scripts['db:migrate']).toBe(
        'echo migrate',
      );
    });

    it('names the missing or invalid option with its flag', () => {
      const projectFolder = tmpDirForTest();

      expect(runDatabase('apply', 'database', '--project-folder', projectFolder).output).toBe(
        'Error: Missing required option: --database-name',
      );
      expect(
        runDatabase(
          'apply',
          'database',
          '--project-folder',
          projectFolder,
          '--database-name',
          'shop',
          '--pool-size',
          '0',
        ).output,
      ).toBe('Error: Invalid option --pool-size: the size must be at least 1');
    });

    it('refuses the option of another module', () => {
      const { code, output } = runDatabase(
        'apply',
        'database-seed',
        '--project-folder',
        tmpDirForTest(),
        '--pool-size',
        '5',
      );

      expect(code).toBe(1);
      expect(output).toContain('Error: unknown option: --pool-size');
    });

    it('describes the module options with --help, without writing anything', () => {
      const projectFolder = tmpDirForTest();

      const { code, output } = runDatabase('apply', 'database', '--help', '--project-folder', projectFolder);

      expect(code).toBe(0);
      expect(output).toBe(
        [
          'Module database: Configures the database',
          'Options:',
          '  --project-folder <text>  (required) Folder of the project to generate or extend',
          '  --database-name <text>   (required) Database name',
          '  --pool-size <number>     (default: 10) Connection pool size',
          '  --migrations             (default: true) Enables migrations',
        ].join('\n'),
      );
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(false);
    });
  });

  it('refuses an unknown module before reading its options', () => {
    const { code, output } = run('apply', 'nope', '--project-folder', tmpDirForTest());

    expect(code).toBe(1);
    expect(output).toBe('Error: Unknown module: nope');
  });

  it('expects the module right after apply', () => {
    const { code, output } = run('apply', '--project-folder', tmpDirForTest(), 'init');

    expect(code).toBe(1);
    expect(output).toContain('Usage:');
  });
  describe('modification of an existing file', () => {
    const withVueApp = () => {
      const projectFolder = tmpDirForTest();
      for (const module of ['init', 'typescript', 'vue-app']) {
        run('apply', module, '--project-folder', projectFolder);
      }
      return projectFolder;
    };

    it('wires pinia in main.ts and says so in the report', () => {
      const projectFolder = withVueApp();

      const { code, output } = run('apply', 'pinia', '--project-folder', projectFolder);

      expect(code).toBe(0);
      expect(output).toContain('(created: 1, modified: 1, replaced: 0, unchanged: 0, skipped: 0)');
      expect(output).toContain('  modified: src/webapp/main.ts');
      expect(readFileSync(join(projectFolder, 'src/webapp/main.ts'), 'utf8')).toContain(
        "import { createPinia } from 'pinia';",
      );
    });

    it('adds the router: files created, main.ts and App.vue modified', () => {
      const projectFolder = withVueApp();

      const { code, output } = run('apply', 'vue-router', '--project-folder', projectFolder);

      expect(code).toBe(0);
      expect(output).toContain('(created: 3, modified: 2, replaced: 0, unchanged: 0, skipped: 0)');
      expect(output).toContain('  modified: src/webapp/App.vue');
      expect(existsSync(join(projectFolder, 'src/webapp/router.ts'))).toBe(true);
    });

    it('wires config and logs in the server and says so in the report', () => {
      const projectFolder = tmpDirForTest();
      for (const module of ['init', 'typescript', 'vitest', 'fastify-server']) {
        run('apply', module, '--project-folder', projectFolder);
      }

      const config = run('apply', 'config', '--project-folder', projectFolder);
      const logs = run('apply', 'logs', '--project-folder', projectFolder);

      expect(config.output).toContain('(created: 2, modified: 1, replaced: 0, unchanged: 0, skipped: 0)');
      expect(config.output).toContain('  modified: src/server/main.ts');
      expect(logs.output).toContain('(created: 2, modified: 1, replaced: 0, unchanged: 0, skipped: 0)');
      expect(logs.output).toContain('  modified: src/server/app.ts');
    });

    it('announces the modification in a dry run', () => {
      const { code, output } = run('apply', 'pinia', '--project-folder', withVueApp(), '--dry-run');

      expect(code).toBe(0);
      expect(output).toContain('  modify     src/webapp/main.ts');
    });

    it('refuses cleanly when the needle is missing', () => {
      const projectFolder = withVueApp();
      const main = join(projectFolder, 'src/webapp/main.ts');
      writeFileSync(main, readFileSync(main, 'utf8').replace('// crafttype-needle-main-imports\n', ''));

      const { code, output } = run('apply', 'pinia', '--project-folder', projectFolder);

      expect(code).toBe(1);
      expect(output).toContain('Error: Cannot modify src/webapp/main.ts: needle not found');
      expect(output).toContain('crafttype-needle-main-imports');
    });
  });
});
