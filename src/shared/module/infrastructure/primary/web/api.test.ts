import { describe, expect, it } from 'vitest';
import { createModulesApplicationService } from '../../../../../composition.js';
import { tmpDirForTest } from '../../../../test/ModuleAssertions.js';
import { handleApi } from './api.js';

const clock = () => new Date('2026-10-20T10:00:00Z');

describe('read-only API', () => {
  const service = createModulesApplicationService({ clock });
  const get = (path: string, defaultProjectFolder = tmpDirForTest()) =>
    handleApi(service, defaultProjectFolder, new URL(path, 'http://127.0.0.1'));

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

  it('does not know any other route', () => {
    expect(get('/api/unknown')).toBeUndefined();
    expect(get('/')).toBeUndefined();
    expect(get('/api/modules/init')).toBeUndefined();
  });
});
