import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../composition.js';
import { tmpDirForTest } from '../../test/ModuleAssertions.js';
import { UnknownModuleError, InvalidPropertyError } from '../domain/errors.js';
import { ModulePropertiesDefinition } from '../domain/ModuleProperties.js';
import { moduleResource } from '../domain/ModuleResource.js';
import type { BasketStep } from './ModulesApplicationService.js';

const clock = () => new Date('2026-10-20T10:00:00Z');

describe('preview of a basket of modules', () => {
  const service = createModulesApplicationService({ clock });
  const slugs = (steps: readonly BasketStep[]) => steps.map(({ slug }) => slug);
  const outcomes = (steps: readonly BasketStep[]) => steps.map(({ outcome }) => outcome);
  const empty = () => tmpDirForTest();
  const applied = (modules: readonly string[]) => {
    const projectFolder = tmpDirForTest();
    for (const slug of modules) service.apply(slug, { projectFolder });
    return projectFolder;
  };

  it('relies on the catalog listing a module after the modules it depends on', () => {
    const order = service.list().map(({ slug }) => slug);

    for (const { slug, dependsOn } of service.list()) {
      for (const dependency of dependsOn) {
        expect(order.indexOf(dependency), `${dependency} before ${slug}`).toBeLessThan(order.indexOf(slug));
      }
    }
  });

  describe('Given an empty folder', () => {
    it('When modules that depend on each other are chosen Then they are all ready, in the order they depend on', () => {
      const projectFolder = empty();

      const { steps, canApply } = service.previewBasket({
        projectFolder,
        modules: ['auth', 'vitest', 'fastify-server', 'typescript', 'init'],
      });

      expect(slugs(steps)).toEqual(['init', 'typescript', 'vitest', 'fastify-server', 'auth']);
      expect(outcomes(steps)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready']);
      expect(canApply).toBe(true);
    });

    it('When a module completes a file another module of the basket creates Then it is planned as a modification', () => {
      const { steps } = service.previewBasket({
        projectFolder: empty(),
        modules: ['init', 'typescript', 'vitest', 'fastify-server', 'config'],
      });

      const config = steps.find(({ slug }) => slug === 'config');
      expect(config).toMatchObject({ outcome: 'ready' });
      const changes = config?.outcome === 'ready' ? config.changes : [];
      expect(changes.filter(({ decision }) => decision === 'edit').map(({ target }) => target)).toContain(
        'src/server/main.ts',
      );
    });

    it('When a module is chosen twice Then it is planned once', () => {
      const { steps } = service.previewBasket({ projectFolder: empty(), modules: ['init', 'init'] });

      expect(slugs(steps)).toEqual(['init']);
    });

    it('When it is previewed Then nothing is written, not even the history', () => {
      const projectFolder = empty();

      service.previewBasket({ projectFolder, modules: ['init', 'typescript'] });

      expect(readdirSync(projectFolder)).toEqual([]);
      expect(service.projectState(projectFolder).applied).toEqual([]);
    });

    it('When it is previewed again Then the answer is the same: each preview starts from the real project', () => {
      const projectFolder = empty();
      const request = { projectFolder, modules: ['init', 'typescript', 'vitest'] };

      expect(service.previewBasket(request)).toEqual(service.previewBasket(request));
    });

    it('When a module is chosen without a prerequisite Then it is blocked, and says which one is missing', () => {
      const { steps, canApply } = service.previewBasket({ projectFolder: empty(), modules: ['init', 'vitest'] });

      expect(steps[0]).toMatchObject({ slug: 'init', outcome: 'ready' });
      expect(steps[1]).toEqual({
        slug: 'vitest',
        outcome: 'blocked',
        error: expect.stringContaining('typescript'),
        missing: ['typescript'],
      });
      expect(canApply).toBe(false);
    });

    it('When a module is blocked Then the following ones are not run, whatever they need', () => {
      const { steps } = service.previewBasket({
        projectFolder: empty(),
        modules: ['init', 'vitest', 'prettier', 'github-actions'],
      });

      expect(slugs(steps)).toEqual(['init', 'vitest', 'prettier', 'github-actions']);
      expect(outcomes(steps)).toEqual(['ready', 'blocked', 'not-run', 'not-run']);
      expect(steps[2]).toEqual({ slug: 'prettier', outcome: 'not-run', after: 'vitest' });
      expect(steps[3]).toEqual({ slug: 'github-actions', outcome: 'not-run', after: 'vitest' });
    });

    it('When a module is unknown Then the preview is refused', () => {
      expect(() => service.previewBasket({ projectFolder: empty(), modules: ['init', 'nope'] })).toThrow(
        UnknownModuleError,
      );
    });
  });

  describe('Given a project that already has modules', () => {
    it('When the basket needs them Then they count as applied', () => {
      const projectFolder = applied(['init', 'typescript']);

      const { steps, canApply } = service.previewBasket({ projectFolder, modules: ['vitest'] });

      expect(outcomes(steps)).toEqual(['ready']);
      expect(canApply).toBe(true);
    });

    it('When the basket has a module already applied Then it is ready and changes nothing', () => {
      const projectFolder = applied(['init']);

      const { steps } = service.previewBasket({ projectFolder, modules: ['init'] });

      expect(steps[0]).toMatchObject({
        outcome: 'ready',
        report: { created: 0, replaced: 0, conflicts: 0 },
      });
    });
  });

  describe('Given an item that differs from what a module wants', () => {
    const conflicting = () => {
      const projectFolder = applied(['init']);
      return {
        projectFolder,
        request: { projectFolder, modules: ['init', 'typescript'], properties: { projectName: 'other' } },
      };
    };

    it('When the policy is the default Then the module is in conflict, and the next ones are not run', () => {
      const { request } = conflicting();

      const { steps, canApply } = service.previewBasket(request);

      expect(outcomes(steps)).toEqual(['conflict', 'not-run']);
      expect(steps[0]).toMatchObject({ report: { conflicts: expect.any(Number) } });
      expect(steps[0]?.outcome === 'conflict' && steps[0].report.conflicts).toBeGreaterThan(0);
      expect(steps[0]?.outcome === 'conflict' && steps[0].changes.map(({ decision }) => decision)).toContain(
        'conflict',
      );
      expect(steps[1]).toEqual({ slug: 'typescript', outcome: 'not-run', after: 'init' });
      expect(canApply).toBe(false);
    });

    it('When the existing items are replaced Then the basket is ready and says what it replaces', () => {
      const { request } = conflicting();

      const { steps, canApply } = service.previewBasket({ ...request, onConflict: 'overwrite' });

      expect(outcomes(steps)).toEqual(['ready', 'ready']);
      expect(steps[0]?.outcome === 'ready' && steps[0].report.replaced).toBeGreaterThan(0);
      expect(canApply).toBe(true);
    });

    it('When the existing items are kept Then the basket is ready and says what it skips', () => {
      const { request } = conflicting();

      const { steps } = service.previewBasket({ ...request, onConflict: 'skip' });

      expect(outcomes(steps)).toEqual(['ready', 'ready']);
      expect(steps[0]?.outcome === 'ready' && steps[0].report.skipped).toBeGreaterThan(0);
    });
  });

  describe('Given properties shared by several modules', () => {
    it('When a value is given Then each module takes the properties it declares', () => {
      const { steps, canApply } = service.previewBasket({
        projectFolder: empty(),
        modules: ['init', 'typescript', 'vitest', 'fastify-server'],
        properties: { projectName: 'shop', serverPort: 4100 },
      });

      expect(canApply).toBe(true);
      const server = steps.find(({ slug }) => slug === 'fastify-server');
      const main =
        server?.outcome === 'ready' ? server.changes.find(({ target }) => target === 'src/server/main.ts') : undefined;
      expect(main?.next).toContain('4100');
      const init = steps.find(({ slug }) => slug === 'init');
      const name = init?.outcome === 'ready' ? init.changes.find(({ target }) => target === 'name') : undefined;
      expect(name?.next).toBe('"shop"');
    });

    it('When a value is wrong Then the module that reads it is blocked, with the reason', () => {
      const { steps } = service.previewBasket({
        projectFolder: empty(),
        modules: ['init', 'typescript', 'vitest', 'fastify-server'],
        properties: { serverPort: 70000 },
      });

      expect(steps[3]).toEqual({
        slug: 'fastify-server',
        outcome: 'blocked',
        error: expect.stringContaining('serverPort'),
        missing: [],
      });
    });

    it('When a property belongs to no module of the basket Then the preview is refused, naming it', () => {
      expect(() =>
        service.previewBasket({ projectFolder: empty(), modules: ['init'], properties: { serverPort: 4100 } }),
      ).toThrow(InvalidPropertyError);
      expect(() =>
        service.previewBasket({ projectFolder: empty(), modules: ['init'], properties: { serverPort: 4100 } }),
      ).toThrow('serverPort');
    });
  });

  it('does not hide a bug of a module', () => {
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

    expect(() => withBug.previewBasket({ projectFolder: empty(), modules: ['exploding'] })).toThrow('bug in a module');
  });
});
