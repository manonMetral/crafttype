import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../../../composition.js';
import { UnknownModuleError } from '../../../domain/errors.js';
import { tmpDirForTest } from '../../../../test/ModuleAssertions.js';
import { apiRoute } from './api.js';

const clock = () => new Date('2026-10-20T10:00:00Z');

describe('API', () => {
  const service = createModulesApplicationService({ clock });
  const get = (path: string, defaultProjectFolder = tmpDirForTest()) => {
    const url = new URL(path, 'http://127.0.0.1');
    return apiRoute(service, defaultProjectFolder, url.pathname)?.handle({ url, body: undefined });
  };

  describe('GET /api/modules', () => {
    it('describes each module of the catalog for someone who builds a form and a tree', () => {
      const response = get('/api/modules');

      expect(response?.status).toBe(200);
      const { modules } = response?.body as { modules: { slug: string }[] };
      expect(modules.map(({ slug }) => slug)).toEqual(service.list().map(({ slug }) => slug));
      expect(modules.find(({ slug }) => slug === 'init')).toEqual({
        slug: 'init',
        group: 'Init',
        description: 'Initializes the project (package.json, .gitignore, README)',
        dependsOn: [],
        tags: expect.arrayContaining([expect.any(String)]),
        properties: [
          {
            key: 'projectName',
            type: 'string',
            mandatory: false,
            description: 'Project name (default: folder name)',
          },
        ],
      });
    });

    it('gives the prerequisites of a module', () => {
      const { modules } = get('/api/modules')?.body as { modules: { slug: string; dependsOn: string[] }[] };

      expect(modules.find(({ slug }) => slug === 'auth')?.dependsOn).toEqual(['fastify-server', 'vitest']);
    });

    it('sends data only: nothing of what makes a module run', () => {
      const { modules } = get('/api/modules')?.body as { modules: { properties: object[] }[] };

      for (const module of modules) {
        expect(Object.keys(module)).toEqual(['slug', 'group', 'description', 'dependsOn', 'tags', 'properties']);
        for (const property of module.properties) {
          expect(Object.keys(property)).toEqual(['key', 'type', 'mandatory', 'description']);
        }
      }
      expect(modules.flatMap(({ properties }) => properties).length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/project', () => {
    it('describes the folder the interface was launched in when none is asked', () => {
      const launchFolder = tmpDirForTest();
      service.apply('init', { projectFolder: launchFolder, projectName: 'shop' });

      const response = get('/api/project', launchFolder);

      expect(response).toEqual({
        status: 200,
        body: {
          projectFolder: launchFolder,
          applied: [{ slug: 'init', appliedAt: '2026-10-20T10:00:00.000Z' }],
          presets: expect.objectContaining({ init: { projectName: 'shop' } }),
        },
      });
    });

    it('describes another folder when one is asked', () => {
      const other = tmpDirForTest();
      service.apply('init', { projectFolder: other, projectName: 'other-shop' });

      const response = get(`/api/project?folder=${encodeURIComponent(other)}`, tmpDirForTest());

      expect(response?.body).toMatchObject({ projectFolder: other, applied: [{ slug: 'init' }] });
    });

    it('proposes the defaults of a new project', () => {
      const response = get('/api/project');

      expect(response?.body).toMatchObject({ applied: [], presets: { 'fastify-server': { serverPort: 3000 } } });
    });

    it.each(['relative/folder', '..', '', '.'])('refuses the folder "%s": it is not an absolute path', (folder) => {
      const response = get(`/api/project?folder=${encodeURIComponent(folder)}`);

      expect(response).toEqual({
        status: 400,
        body: { error: 'the folder must be an absolute path' },
      });
    });
  });

  describe('POST /api/basket/preview', () => {
    const post = (body: unknown, defaultProjectFolder = tmpDirForTest()) => {
      const url = new URL('/api/basket/preview', 'http://127.0.0.1');
      return apiRoute(service, defaultProjectFolder, url.pathname)?.handle({ url, body });
    };
    const absolute = () => tmpDirForTest();

    it('says what each module of the basket would do, in the order they depend on', () => {
      const projectFolder = absolute();

      const response = post({ projectFolder, modules: ['typescript', 'init'] });

      expect(response?.status).toBe(200);
      const body = response?.body as {
        projectFolder: string;
        canApply: boolean;
        steps: { slug: string; outcome: string }[];
      };
      expect(body.projectFolder).toBe(projectFolder);
      expect(body.canApply).toBe(true);
      expect(body.steps.map(({ slug, outcome }) => `${slug}:${outcome}`)).toEqual(['init:ready', 'typescript:ready']);
    });

    it('describes the changes without sending the content of the files', () => {
      const response = post({ projectFolder: absolute(), modules: ['init'] });

      const { steps } = response?.body as { steps: Record<string, any>[] };
      expect(Object.keys(steps[0] ?? {})).toEqual(['slug', 'outcome', 'report', 'warnings', 'changes']);
      expect(steps[0]?.['report']).toMatchObject({ created: expect.any(Number), conflicts: 0 });
      const changes = steps[0]?.['changes'] as Record<string, string>[];
      expect(changes.length).toBeGreaterThan(0);
      for (const change of changes) {
        expect(Object.keys(change)).toEqual(['kind', 'target', 'decision', 'description']);
      }
      expect(changes).toContainEqual({
        kind: 'file',
        target: 'README.md',
        decision: 'create',
        description: 'README.md',
      });
    });

    it("describes a conflict with the existing value and the module's", () => {
      const projectFolder = absolute();
      service.apply('init', { projectFolder, projectName: 'shop' });

      const response = post({ projectFolder, modules: ['init'], properties: { projectName: 'other' } });

      const { canApply, steps } = response?.body as {
        canApply: boolean;
        steps: { outcome: string; changes: Record<string, string>[] }[];
      };
      expect(canApply).toBe(false);
      expect(steps[0]?.outcome).toBe('conflict');
      expect(steps[0]?.changes).toContainEqual({
        kind: 'field',
        target: 'name',
        decision: 'conflict',
        description: expect.stringContaining('existing: "shop", module: "other"'),
      });
    });

    it('applies the policy for the conflicts of the whole basket', () => {
      const projectFolder = absolute();
      service.apply('init', { projectFolder, projectName: 'shop' });

      const response = post({
        projectFolder,
        modules: ['init'],
        properties: { projectName: 'other' },
        onConflict: 'overwrite',
      });

      expect((response?.body as { canApply: boolean }).canApply).toBe(true);
    });

    it('tells what blocks a module, and what was not run because of it', () => {
      const response = post({ projectFolder: absolute(), modules: ['init', 'vitest', 'prettier'] });

      expect((response?.body as { steps: unknown[] }).steps).toEqual([
        expect.objectContaining({ slug: 'init', outcome: 'ready' }),
        { slug: 'vitest', outcome: 'blocked', error: expect.stringContaining('typescript'), missing: ['typescript'] },
        { slug: 'prettier', outcome: 'not-run', after: 'vitest' },
      ]);
    });

    it('describes the folder the interface was launched in when none is given', () => {
      const launchFolder = absolute();
      service.apply('init', { projectFolder: launchFolder });

      const response = post({ modules: ['typescript'] }, launchFolder);

      expect(response?.body).toMatchObject({ projectFolder: launchFolder, canApply: true });
    });

    it.each([
      ['no body', undefined],
      ['a text', 'init'],
      ['a list', ['init']],
      ['null', null],
    ])('refuses %s: a JSON object is expected', (_case, body) => {
      expect(post(body)).toEqual({ status: 400, body: { error: 'the body must be a JSON object' } });
    });

    it.each([
      ['no modules', {}],
      ['an empty list of modules', { modules: [] }],
      ['modules that are not a list', { modules: 'init' }],
      ['modules that are not names', { modules: ['init', 1] }],
    ])('refuses %s', (_case, body) => {
      expect(post(body)).toEqual({
        status: 400,
        body: { error: '"modules" must be a non-empty list of module names' },
      });
    });

    it.each([
      ['a text', 'x'],
      ['null', null],
      ['a list', [1]],
      ['a value that is a list', { serverPort: [1] }],
      ['a value that is null', { serverPort: null }],
    ])('refuses properties that are %s', (_case, properties) => {
      expect(post({ modules: ['init'], properties })).toEqual({
        status: 400,
        body: { error: '"properties" must be an object of texts, numbers and booleans' },
      });
    });

    it('accepts texts, numbers and booleans as properties', () => {
      expect(post({ projectFolder: absolute(), modules: ['init'], properties: { projectName: 'shop' } })?.status).toBe(
        200,
      );
    });

    it.each(['force', 1, null, ''])('refuses the policy %j', (onConflict) => {
      expect(post({ modules: ['init'], onConflict })).toEqual({
        status: 400,
        body: { error: '"onConflict" must be "fail", "skip" or "overwrite"' },
      });
    });

    it.each(['relative/folder', '', 3, null])(
      'refuses the folder %j: an absolute path is expected',
      (projectFolder) => {
        expect(post({ modules: ['init'], projectFolder })).toEqual({
          status: 400,
          body: { error: 'the folder must be an absolute path' },
        });
      },
    );

    it('leaves an unknown module to the server, as any error of the tool', () => {
      expect(() => post({ modules: ['nope'] })).toThrow(UnknownModuleError);
    });
  });

  describe('POST /api/basket/apply', () => {
    const post = (body: unknown, defaultProjectFolder = tmpDirForTest()) => {
      const url = new URL('/api/basket/apply', 'http://127.0.0.1');
      return apiRoute(service, defaultProjectFolder, url.pathname)?.handle({ url, body });
    };
    const absolute = () => tmpDirForTest();

    it('only answers to POST: it writes', () => {
      expect(apiRoute(service, absolute(), '/api/basket/apply')?.methods).toEqual(['POST']);
    });

    it('writes the basket, and says what each module did, in the order they depend on', () => {
      const projectFolder = join(absolute(), 'shop');

      const response = post({ projectFolder, modules: ['typescript', 'init'], properties: { projectName: 'shop' } });

      expect(response?.status).toBe(200);
      expect(response?.body).toEqual({
        outcome: 'applied',
        projectFolder,
        steps: [
          expect.objectContaining({ slug: 'init', report: expect.objectContaining({ created: expect.any(Number) }) }),
          expect.objectContaining({ slug: 'typescript' }),
        ],
      });
      expect(JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8')).name).toBe('shop');
      expect(service.projectState(projectFolder).applied.map(({ slug }) => slug)).toEqual(['init', 'typescript']);
    });

    it('describes the changes without sending the content of the files', () => {
      const response = post({ projectFolder: absolute(), modules: ['init'] });

      const { steps } = response?.body as { steps: Record<string, any>[] };
      expect(Object.keys(steps[0] ?? {})).toEqual(['slug', 'report', 'warnings', 'changes']);
      const changes = steps[0]?.['changes'] as Record<string, string>[];
      for (const change of changes) {
        expect(Object.keys(change)).toEqual(['kind', 'target', 'decision', 'description']);
      }
      expect(changes).toContainEqual({
        kind: 'file',
        target: 'README.md',
        decision: 'create',
        description: 'README.md',
      });
    });

    it('refuses a basket that cannot apply, says why as the preview does, and writes nothing', () => {
      const projectFolder = absolute();

      const response = post({ projectFolder, modules: ['init', 'vitest', 'prettier'] });

      expect(response?.status).toBe(200);
      expect(response?.body).toEqual({
        outcome: 'refused',
        preview: {
          projectFolder,
          canApply: false,
          steps: [
            expect.objectContaining({ slug: 'init', outcome: 'ready' }),
            {
              slug: 'vitest',
              outcome: 'blocked',
              error: expect.stringContaining('typescript'),
              missing: ['typescript'],
            },
            { slug: 'prettier', outcome: 'not-run', after: 'vitest' },
          ],
        },
      });
      expect(readdirSync(projectFolder)).toEqual([]);
    });

    it('applies the policy for the conflicts of the whole basket', () => {
      const projectFolder = absolute();
      service.apply('init', { projectFolder, projectName: 'shop' });
      const request = { projectFolder, modules: ['init'], properties: { projectName: 'other' } };

      expect((post(request)?.body as { outcome: string }).outcome).toBe('refused');
      expect((post({ ...request, onConflict: 'overwrite' })?.body as { outcome: string }).outcome).toBe('applied');
      expect(JSON.parse(readFileSync(join(projectFolder, 'package.json'), 'utf8')).name).toBe('other');
    });

    it('writes in the folder the interface was launched in when none is given', () => {
      const launchFolder = absolute();

      const response = post({ modules: ['init'] }, launchFolder);

      expect(response?.body).toMatchObject({ outcome: 'applied', projectFolder: launchFolder });
      expect(readdirSync(launchFolder)).toContain('package.json');
    });

    it.each([
      ['no body', undefined, 'the body must be a JSON object'],
      ['no modules', {}, '"modules" must be a non-empty list of module names'],
      [
        'properties that are not values',
        { modules: ['init'], properties: { projectName: [1] } },
        '"properties" must be an object of texts, numbers and booleans',
      ],
      [
        'an unknown policy',
        { modules: ['init'], onConflict: 'force' },
        '"onConflict" must be "fail", "skip" or "overwrite"',
      ],
      [
        'a relative folder',
        { modules: ['init'], projectFolder: 'relative/folder' },
        'the folder must be an absolute path',
      ],
    ])('refuses %s, as the preview does, and writes nothing', (_case, body, error) => {
      const launchFolder = absolute();

      expect(post(body, launchFolder)).toEqual({ status: 400, body: { error } });
      expect(readdirSync(launchFolder)).toEqual([]);
    });

    it('leaves an unknown module to the server, as any error of the tool', () => {
      expect(() => post({ modules: ['nope'] })).toThrow(UnknownModuleError);
    });
  });

  it('does not know any other route', () => {
    expect(get('/api/unknown')).toBeUndefined();
    expect(get('/')).toBeUndefined();
    expect(get('/api/modules/init')).toBeUndefined();
  });
});
