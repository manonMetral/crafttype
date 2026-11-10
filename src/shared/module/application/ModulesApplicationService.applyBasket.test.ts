import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { allModuleResources } from '../../../generator/modules.js';
import { FileSystemModuleResourcesReader } from '../infrastructure/secondary/FileSystemModuleResourcesReader.js';
import { FileSystemModulesHistory } from '../infrastructure/secondary/FileSystemModulesHistory.js';
import { FileSystemNodePackagesVersionsReader } from '../infrastructure/secondary/FileSystemNodePackagesVersionsReader.js';
import { FileSystemProjectFiles } from '../infrastructure/secondary/FileSystemProjectFiles.js';
import { MustacheTemplateRenderer } from '../infrastructure/secondary/MustacheTemplateRenderer.js';
import { NodePathNormalizer } from '../infrastructure/secondary/NodePathNormalizer.js';
import { OverlayProjectSimulator } from '../infrastructure/secondary/OverlayProjectSimulator.js';
import { resourcesRoot } from '../infrastructure/secondary/resourcesRoot.js';
import { SemverVersionComparator } from '../infrastructure/secondary/SemverVersionComparator.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import { InvalidPropertyError, UnknownModuleError } from '../domain/errors.js';
import { ModulePropertiesDefinition } from '../domain/ModuleProperties.js';
import { moduleResource } from '../domain/ModuleResource.js';
import type { ProjectFiles } from '../domain/ports.js';
import { ModulesApplicationService, type BasketApplication } from './ModulesApplicationService.js';

const clock = () => new Date('2026-10-20T10:00:00Z');
const readJson = (folder: string, path: string) => JSON.parse(readFileSync(join(folder, path), 'utf8'));

/** The steps of an application that went through: the test fails here if it did not. */
const stepsOf = (application: BasketApplication) => {
  if (application.outcome !== 'applied') {
    throw new Error('the basket was refused');
  }
  return application.steps;
};

describe('application of a basket of modules', () => {
  const service = createModulesApplicationService({ clock });
  const empty = () => tmpDirForTest();
  const applied = (modules: readonly string[]) => {
    const projectFolder = tmpDirForTest();
    for (const slug of modules) service.apply(slug, { projectFolder });
    return projectFolder;
  };
  const appliedSlugs = (projectFolder: string) => service.projectState(projectFolder).applied.map(({ slug }) => slug);

  describe('Given a folder that does not exist yet', () => {
    it('When the basket can apply Then it creates the project, the modules in the order they depend on', () => {
      const projectFolder = join(empty(), 'shop');

      const application = service.applyBasket({ projectFolder, modules: ['vitest', 'typescript', 'init'] });

      expect(application.outcome).toBe('applied');
      expect(stepsOf(application).map(({ slug }) => slug)).toEqual(['init', 'typescript', 'vitest']);
      expect(existsSync(join(projectFolder, 'package.json'))).toBe(true);
      expect(existsSync(join(projectFolder, 'tsconfig.json'))).toBe(true);
      expect(appliedSlugs(projectFolder)).toEqual(['init', 'typescript', 'vitest']);
    });

    it('When it applied Then it says what each module did, as the preview said it would', () => {
      const request = { projectFolder: join(empty(), 'shop'), modules: ['init', 'typescript', 'vitest'] };
      const preview = service.previewBasket(request);

      const application = service.applyBasket(request);

      const previewed = preview.steps.map((step) => (step.outcome === 'ready' ? step.report : undefined));
      expect(stepsOf(application).map(({ report }) => report)).toEqual(previewed);
      expect(stepsOf(application)[0]?.changes.map(({ decision }) => decision)).toContain('create');
    });

    it('When it applied Then the history holds each module with the properties it declares', () => {
      const projectFolder = join(empty(), 'shop');

      service.applyBasket({
        projectFolder,
        modules: ['init', 'typescript', 'vitest', 'fastify-server'],
        properties: { projectName: 'shop', serverPort: 4100 },
      });

      expect(service.projectState(projectFolder).applied).toEqual([
        { slug: 'init', properties: { projectName: 'shop' }, appliedAt: '2026-10-20T10:00:00.000Z' },
        { slug: 'typescript', properties: {}, appliedAt: '2026-10-20T10:00:00.000Z' },
        { slug: 'vitest', properties: {}, appliedAt: '2026-10-20T10:00:00.000Z' },
        { slug: 'fastify-server', properties: { serverPort: 4100 }, appliedAt: '2026-10-20T10:00:00.000Z' },
      ]);
      expect(readJson(projectFolder, 'package.json').name).toBe('shop');
      expect(readFileSync(join(projectFolder, 'src/server/main.ts'), 'utf8')).toContain('4100');
    });

    it('When a module completes a file another module of the basket creates Then the file holds both', () => {
      const projectFolder = join(empty(), 'shop');

      service.applyBasket({
        projectFolder,
        modules: ['init', 'typescript', 'vitest', 'fastify-server', 'config'],
      });

      expect(readFileSync(join(projectFolder, 'src/server/main.ts'), 'utf8')).toContain('loadConfig');
    });

    it('When it does not change what it receives Then a frozen request is enough', () => {
      const projectFolder = join(empty(), 'shop');
      const request = Object.freeze({
        projectFolder,
        modules: Object.freeze(['init', 'typescript']),
        properties: Object.freeze({ projectName: 'shop' }),
      });

      expect(service.applyBasket(request).outcome).toBe('applied');
    });
  });

  describe('Given a basket that cannot apply', () => {
    it('When a module is blocked Then nothing is written, not even the modules that were ready', () => {
      const projectFolder = empty();

      const application = service.applyBasket({ projectFolder, modules: ['init', 'vitest'] });

      expect(application).toEqual({
        outcome: 'refused',
        preview: service.previewBasket({ projectFolder, modules: ['init', 'vitest'] }),
      });
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it('When a conflict is not accepted Then nothing is written, and the preview says which', () => {
      const projectFolder = applied(['init']);
      const before = readFileSync(join(projectFolder, 'package.json'), 'utf8');

      const application = service.applyBasket({
        projectFolder,
        modules: ['init', 'typescript'],
        properties: { projectName: 'other' },
      });

      expect(application.outcome).toBe('refused');
      expect(application.outcome === 'refused' && application.preview.steps.map(({ outcome }) => outcome)).toEqual([
        'conflict',
        'not-run',
      ]);
      expect(readFileSync(join(projectFolder, 'package.json'), 'utf8')).toBe(before);
      expect(appliedSlugs(projectFolder)).toEqual(['init']);
    });

    it('When a module is unknown Then the basket is refused, and nothing is written', () => {
      const projectFolder = empty();

      expect(() => service.applyBasket({ projectFolder, modules: ['init', 'nope'] })).toThrow(UnknownModuleError);
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it('When a property belongs to no module of the basket Then the basket is refused, and nothing is written', () => {
      const projectFolder = empty();

      expect(() => service.applyBasket({ projectFolder, modules: ['init'], properties: { serverPort: 4100 } })).toThrow(
        InvalidPropertyError,
      );
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it('When a value is wrong Then the basket is refused, and nothing is written', () => {
      const projectFolder = empty();

      const application = service.applyBasket({
        projectFolder,
        modules: ['init', 'typescript', 'vitest', 'fastify-server'],
        properties: { serverPort: 70000 },
      });

      expect(application.outcome).toBe('refused');
      expect(readdirSync(projectFolder)).toEqual([]);
    });
  });

  describe('Given an item that differs from what a module wants', () => {
    const conflicting = () => {
      const projectFolder = applied(['init']);
      return { projectFolder, modules: ['init', 'typescript'], properties: { projectName: 'other' } };
    };

    it('When the existing items are replaced Then the basket applies and the items are replaced', () => {
      const request = conflicting();

      const application = service.applyBasket({ ...request, onConflict: 'overwrite' });

      expect(stepsOf(application)[0]?.report.replaced).toBeGreaterThan(0);
      expect(readJson(request.projectFolder, 'package.json').name).toBe('other');
      expect(appliedSlugs(request.projectFolder)).toEqual(['init', 'typescript']);
    });

    it('When the existing items are kept Then the basket applies and the items are left as they are', () => {
      const request = conflicting();
      const name = readJson(request.projectFolder, 'package.json').name;

      const application = service.applyBasket({ ...request, onConflict: 'skip' });

      expect(stepsOf(application)[0]?.report.skipped).toBeGreaterThan(0);
      expect(readJson(request.projectFolder, 'package.json').name).toBe(name);
      expect(existsSync(join(request.projectFolder, 'tsconfig.json'))).toBe(true);
    });
  });

  describe('Given a project that already has modules', () => {
    it('When the basket needs them Then they count as applied, and only the basket is written', () => {
      const projectFolder = applied(['init', 'typescript']);

      const application = service.applyBasket({ projectFolder, modules: ['vitest'] });

      expect(stepsOf(application).map(({ slug }) => slug)).toEqual(['vitest']);
      expect(appliedSlugs(projectFolder)).toEqual(['init', 'typescript', 'vitest']);
    });

    it('When the same basket is applied again Then nothing changes, not even the history', () => {
      const projectFolder = join(empty(), 'shop');
      const request = { projectFolder, modules: ['init', 'typescript', 'vitest'] };
      service.applyBasket(request);
      const history = readFileSync(join(projectFolder, '.crafttype/modules/history.json'), 'utf8');

      const again = service.applyBasket(request);

      expect(stepsOf(again).map(({ report }) => [report.created, report.edited, report.replaced])).toEqual([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ]);
      expect(readFileSync(join(projectFolder, '.crafttype/modules/history.json'), 'utf8')).toBe(history);
    });
  });

  describe('Given a failure while the modules are written', () => {
    /** The disk refuses to write one file, as long as `failing` is set. */
    class FailingFiles implements ProjectFiles {
      failing = true;
      private readonly files = new FileSystemProjectFiles();

      constructor(private readonly refused: string) {}

      read(projectFolder: string, path: string): string | undefined {
        return this.files.read(projectFolder, path);
      }

      write(projectFolder: string, path: string, content: string): void {
        if (this.failing && path === this.refused) {
          throw new Error(`EACCES: permission denied, open '${path}'`);
        }
        this.files.write(projectFolder, path, content);
      }
    }

    const serviceOn = (files: ProjectFiles) => {
      const root = resourcesRoot();
      return new ModulesApplicationService({
        resources: allModuleResources(new FileSystemNodePackagesVersionsReader(root)),
        files,
        resourcesReader: new FileSystemModuleResourcesReader(root),
        renderer: new MustacheTemplateRenderer(),
        history: new FileSystemModulesHistory(files),
        versions: new SemverVersionComparator(),
        paths: new NodePathNormalizer(),
        simulator: new OverlayProjectSimulator(files),
        clock,
      });
    };

    it('When it stops Then the error is not hidden, the modules written before it stay recorded, and a second try completes the project', () => {
      const files = new FailingFiles('tsconfig.json');
      const failing = serviceOn(files);
      const projectFolder = join(empty(), 'shop');
      const request = { projectFolder, modules: ['init', 'typescript', 'vitest'] };

      expect(() => failing.applyBasket(request)).toThrow("EACCES: permission denied, open 'tsconfig.json'");
      expect(failing.projectState(projectFolder).applied.map(({ slug }) => slug)).toEqual(['init']);

      files.failing = false;
      const application = failing.applyBasket({ ...request, modules: ['typescript', 'vitest'] });

      expect(stepsOf(application).map(({ slug }) => slug)).toEqual(['typescript', 'vitest']);
      expect(failing.projectState(projectFolder).applied.map(({ slug }) => slug)).toEqual([
        'init',
        'typescript',
        'vitest',
      ]);
    });
  });

  it('does not hide a bug of a module, and writes nothing', () => {
    const exploding = moduleResource()
      .slug('exploding')
      .propertiesDefinition(ModulePropertiesDefinition.builder().build())
      .apiDoc('Test', 'Fails with a bug that is not an error of the tool')
      .standalone()
      .tags('test')
      .factory(() => {
        throw new TypeError('bug in a module');
      });
    const withBug = createModulesApplicationService({ clock, extraResources: [exploding] });
    const projectFolder = empty();

    expect(() => withBug.applyBasket({ projectFolder, modules: ['init', 'exploding'] })).toThrow('bug in a module');
    expect(readdirSync(projectFolder)).toEqual([]);
  });
});
