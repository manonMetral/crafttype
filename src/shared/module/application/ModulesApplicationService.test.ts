import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import { MissingModuleDependenciesError, MissingPropertyError, UnknownModuleError } from '../domain/errors.js';

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
});
