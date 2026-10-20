import { existsSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import {
  InvalidProjectFileError,
  InvalidPropertyError,
  MissingModuleDependenciesError,
  MissingPropertyError,
  ModuleConflictError,
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

      service.apply('init', { projectFolder, projectName: 'autre' }, { force: true });

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
});
