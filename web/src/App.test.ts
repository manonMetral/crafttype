import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Api } from './api';
import App from './App.vue';
import type { BasketPreview, Catalog, ModuleInfo, PreviewRequest, ProjectState } from './types';

const mod = (
  slug: string,
  group: string,
  dependsOn: string[] = [],
  properties: ModuleInfo['properties'] = [],
): ModuleInfo => ({
  slug,
  group,
  description: `Adds ${slug}`,
  dependsOn,
  tags: [],
  properties,
});
const projectName = { key: 'projectName', type: 'string', mandatory: false, description: 'Project name' } as const;
const serverPort = { key: 'serverPort', type: 'number', mandatory: false, description: 'HTTP port' } as const;

const catalog: Catalog = {
  modules: [
    mod('init', 'Init', [], [projectName]),
    mod('typescript', 'TypeScript', ['init']),
    mod('vitest', 'Tests', ['typescript']),
    mod('prettier', 'Quality', ['init']),
    mod('fastify-server', 'Server', ['typescript', 'vitest'], [serverPort]),
  ],
};
const project: ProjectState = {
  projectFolder: '/work/shop',
  applied: [],
  presets: { init: { projectName: 'shop' }, 'fastify-server': { serverPort: 3000 } },
};
const readyPreview: BasketPreview = {
  projectFolder: '/work/shop',
  canApply: true,
  steps: [
    {
      slug: 'init',
      outcome: 'ready',
      report: { created: 1, edited: 0, replaced: 0, unchanged: 0, kept: 0, skipped: 0, conflicts: 0 },
      warnings: [],
      changes: [{ kind: 'file', target: 'README.md', decision: 'create', description: 'README.md' }],
    },
  ],
};

const apiOf = (overrides: Partial<Api> = {}) => {
  const api = {
    catalog: vi.fn(async () => catalog),
    project: vi.fn(async (_folder?: string) => project),
    preview: vi.fn(async (_request: PreviewRequest) => readyPreview),
  };
  return Object.assign(api, overrides);
};

describe('page of the local interface', () => {
  let page: VueWrapper | undefined;
  afterEach(() => page?.unmount());

  const open = async (api: Api = apiOf()) => {
    page = mount(App, { attachTo: document.body, props: { api } });
    await flushPromises();
    return page;
  };
  const node = (key: string) => page!.get(`[data-key="${key}"]`);
  const basketItems = () => page!.findAll('.basket .item .name').map((item) => item.text());
  const addFromDetails = async (slug: string) => {
    await node(`module:${slug}`).trigger('click');
    await page!.get('.details button').trigger('click');
  };
  const preview = async () => {
    await page!.get('button.preview').trigger('click');
    await flushPromises();
  };

  describe('Given the page cannot start', () => {
    it('asks to open the address crafttype ui printed when it has no token', () => {
      page = mount(App, { props: { api: undefined } });

      expect(page.get('[role="alert"]').text()).toContain('crafttype ui');
      expect(page.text()).toContain('token');
    });

    it('says it is loading until the server has answered', async () => {
      page = mount(App, { props: { api: apiOf({ catalog: () => new Promise(() => {}) }) } });
      await flushPromises();

      expect(page.get('[role="status"]').text()).toContain('Loading');
    });

    it('shows what the server refused, and how to fix it', async () => {
      const refusing = apiOf({
        catalog: async () => {
          throw new ApiError('missing or invalid token', 401, 'send the token printed by crafttype ui');
        },
      });
      await open(refusing);

      const alert = page!.get('[role="alert"]').text();
      expect(alert).toContain('missing or invalid token');
      expect(alert).toContain('send the token printed by crafttype ui');
      expect(page!.find('[role="tree"]').exists()).toBe(false);
    });

    it("shows a failure that is not the server's answer", async () => {
      await open(apiOf({ project: async () => Promise.reject(new TypeError('Failed to fetch')) }));

      expect(page!.get('[role="alert"]').text()).toContain('Failed to fetch');
    });
  });

  describe('Given the catalog and the project are loaded', () => {
    it('shows the folder of the project, and the tree of the modules by group', async () => {
      await open();

      expect(page!.get<HTMLInputElement>('input[name="folder"]').element.value).toBe('/work/shop');
      const groups = page!.findAll('[aria-level="1"]').map((group) => group.get('.groupName').text());
      expect(groups).toEqual(['Init', 'TypeScript', 'Tests', 'Quality', 'Server']);
    });

    it('marks the modules the project already has', async () => {
      await open(
        apiOf({
          project: async () => ({ ...project, applied: [{ slug: 'init', appliedAt: '2026-10-20T10:00:00.000Z' }] }),
        }),
      );

      expect(node('module:init').text()).toContain('Applied');
    });

    it('asks to choose a module before one is chosen, then shows the details of the one that is', async () => {
      await open();
      expect(page!.get('.details').text()).toContain('Choose a module');

      await node('module:vitest').trigger('click');

      expect(page!.get('.details h2').text()).toBe('vitest');
      expect(page!.get('.details').text()).toContain('Adds vitest');
    });
  });

  describe('Given modules are put in the basket', () => {
    it('adds a module with what it needs, flagged as added automatically, in the order the catalog gives', async () => {
      await open();

      await addFromDetails('vitest');

      expect(basketItems()).toEqual(['init', 'typescript', 'vitest']);
      const labelled = page!.findAll('.basket .item').map((item) => item.text().includes('Added automatically'));
      expect(labelled).toEqual([true, true, false]);
      expect(node('module:vitest').text()).toContain('In basket');
    });

    it('announces what a module brings before it is added, and the button then offers to remove it', async () => {
      await open();
      await node('module:vitest').trigger('click');

      expect(page!.get('.details .also').text()).toContain('init, typescript');
      await page!.get('.details button').trigger('click');

      expect(page!.get('.details button').text()).toBe('Remove from basket');
      expect(page!.find('.details .also').exists()).toBe(false);
    });

    it('does not announce what the basket already holds as something that would be added', async () => {
      await open();
      await addFromDetails('typescript');

      await node('module:vitest').trigger('click');

      expect(page!.find('.details .also').exists()).toBe(false);
    });

    it('does not add what the project already has', async () => {
      await open(apiOf({ project: async () => ({ ...project, applied: [{ slug: 'init', appliedAt: 'x' }] }) }));

      await addFromDetails('vitest');

      expect(basketItems()).toEqual(['typescript', 'vitest']);
    });

    it('puts the module that has the focus in the basket with Space, and takes it out with Space again', async () => {
      await open();

      await node('module:prettier').trigger('keydown', { key: ' ' });
      expect(basketItems()).toEqual(['init', 'prettier']);

      await node('module:prettier').trigger('keydown', { key: ' ' });
      expect(basketItems()).toEqual([]);
    });

    it('does not put a module the project has in the basket', async () => {
      await open(apiOf({ project: async () => ({ ...project, applied: [{ slug: 'init', appliedAt: 'x' }] }) }));

      await node('module:init').trigger('keydown', { key: ' ' });

      expect(basketItems()).toEqual([]);
    });

    it('takes a module out with its button, and what only it needed', async () => {
      await open();
      await addFromDetails('vitest');

      await page!.get('button[aria-label="Remove vitest from the basket"]').trigger('click');

      expect(basketItems()).toEqual([]);
    });

    it('warns of a module that lost a prerequisite taken out by hand', async () => {
      await open();
      await addFromDetails('vitest');

      await page!.get('button[aria-label="Remove typescript from the basket"]').trigger('click');

      expect(basketItems()).toEqual(['init', 'vitest']);
      expect(page!.get('.basket .missing').text()).toContain('typescript');
    });
  });

  describe('Given options', () => {
    it('are asked for the modules of the basket only, once each, with the values the project proposes', async () => {
      await open();
      expect(page!.find('fieldset').exists()).toBe(false);

      await addFromDetails('fastify-server');

      expect(page!.findAll('.field code').map((field) => field.text())).toEqual(['projectName', 'serverPort']);
      expect(page!.get<HTMLInputElement>('#option-projectName').element.value).toBe('shop');
      expect(page!.get<HTMLInputElement>('#option-serverPort').element.value).toBe('3000');
    });

    it('go away with the modules that read them', async () => {
      await open();
      await addFromDetails('init');
      await addFromDetails('fastify-server');

      await page!.get('button[aria-label="Remove fastify-server from the basket"]').trigger('click');

      expect(page!.findAll('.field code').map((field) => field.text())).toEqual(['projectName']);
    });
  });

  describe('Given a basket to preview', () => {
    it('sends the modules in order, with the options as typed, the policy and the folder', async () => {
      const api = apiOf();
      await open(api);
      await addFromDetails('fastify-server');
      await page!.get('#option-serverPort').setValue('4100');
      await page!.get('#option-projectName').setValue('my-shop');
      await page!.get('select').setValue('skip');

      expect(page!.get<HTMLInputElement>('input[name="folder"]').element.value).toBe('/work/my-shop');
      await preview();

      expect(api.preview).toHaveBeenCalledTimes(1);
      expect(api.preview).toHaveBeenCalledWith({
        projectFolder: '/work/my-shop',
        modules: ['init', 'typescript', 'vitest', 'fastify-server'],
        properties: { projectName: 'my-shop', serverPort: 4100 },
        onConflict: 'skip',
      });
    });

    it('shows the answer', async () => {
      await open();
      await addFromDetails('init');

      await preview();

      expect(page!.get('.result [role="status"]').text()).toContain('every module would apply');
      expect(page!.get('.result .step').text()).toContain('init');
    });

    it('sends nothing for an option that was cleared, and does not fill it again', async () => {
      const api = apiOf();
      await open(api);
      await addFromDetails('fastify-server');
      await page!.get('#option-serverPort').setValue('');
      await addFromDetails('prettier');

      expect(page!.get<HTMLInputElement>('#option-serverPort').element.value).toBe('');
      await preview();

      expect(vi.mocked(api.preview).mock.calls[0]?.[0].properties).toEqual({ projectName: 'shop' });
    });

    it('forgets the answer as soon as what it was for changes: the basket, an option or the policy', async () => {
      await open();
      await addFromDetails('init');

      await preview();
      expect(page!.find('.result').exists()).toBe(true);
      await addFromDetails('prettier');
      expect(page!.find('.result').exists()).toBe(false);

      await preview();
      await page!.get('#option-projectName').setValue('other');
      expect(page!.find('.result').exists()).toBe(false);

      await preview();
      await page!.get('select').setValue('overwrite');
      expect(page!.find('.result').exists()).toBe(false);
    });

    it('keeps the answer when only the module that is looked at changes', async () => {
      await open();
      await addFromDetails('init');
      await preview();

      await node('module:vitest').trigger('click');

      expect(page!.find('.result').exists()).toBe(true);
    });

    it('shows what the server refused, with its hint, and no answer', async () => {
      const refusing = apiOf({
        preview: vi.fn(async () => {
          throw new ApiError('Unknown module: nope', 422, 'check the catalog');
        }),
      });
      await open(refusing);
      await addFromDetails('init');

      await preview();

      const alert = page!.get('.basketColumn [role="alert"]').text();
      expect(alert).toContain('Unknown module: nope');
      expect(alert).toContain('check the catalog');
      expect(page!.find('.result').exists()).toBe(false);
    });

    it("shows a failure that is not the server's answer, and forgets it at the next try", async () => {
      const api = apiOf({
        preview: vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(readyPreview),
      });
      await open(api);
      await addFromDetails('init');

      await preview();
      expect(page!.get('.basketColumn [role="alert"]').text()).toContain('Failed to fetch');

      await preview();
      expect(page!.find('.basketColumn [role="alert"]').exists()).toBe(false);
      expect(page!.find('.result').exists()).toBe(true);
    });

    it('waits for the answer, and cannot be asked twice meanwhile', async () => {
      let answer: (value: BasketPreview) => void = () => {};
      const api = apiOf({ preview: vi.fn(() => new Promise<BasketPreview>((resolve) => (answer = resolve))) });
      await open(api);
      await addFromDetails('init');

      await page!.get('button.preview').trigger('click');
      expect(page!.get('button.preview').text()).toBe('Previewing…');
      expect(page!.get('button.preview').attributes('disabled')).toBeDefined();

      answer(readyPreview);
      await flushPromises();
      expect(page!.get('button.preview').text()).toBe('Preview');
      expect(page!.find('.result').exists()).toBe(true);
    });

    it('ignores the answer to a basket that is no longer the one on screen', async () => {
      let answer: (value: BasketPreview) => void = () => {};
      const api = apiOf({ preview: vi.fn(() => new Promise<BasketPreview>((resolve) => (answer = resolve))) });
      await open(api);
      await addFromDetails('init');
      await page!.get('button.preview').trigger('click');

      await addFromDetails('prettier');
      answer(readyPreview);
      await flushPromises();

      expect(page!.find('.result').exists()).toBe(false);
      expect(page!.get('button.preview').text()).toBe('Preview');
    });
  });

  describe('Given the name of the project is changed', () => {
    const typed: ProjectState = { projectFolder: '/work/my-app', applied: [], presets: {} };
    const here: ProjectState = { ...project, applied: [{ slug: 'typescript', appliedAt: 'x' }] };
    const byFolder = (folders: Record<string, ProjectState> = {}) =>
      vi.fn(async (folder?: string) => (folder === undefined ? here : (folders[folder] ?? typed)));
    const rename = (name: string) => page!.get('#option-projectName').setValue(name);
    const folderField = () => page!.get<HTMLInputElement>('input[name="folder"]').element.value;
    const withName = async (api: Api) => {
      await open(api);
      await addFromDetails('init');
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('moves the folder along: its last segment becomes the name', async () => {
      await withName(apiOf({ project: byFolder() }));

      await rename('my-app');

      expect(folderField()).toBe('/work/my-app');
    });

    it('follows every keystroke, from where the folder was last', async () => {
      await withName(apiOf({ project: byFolder() }));

      await rename('a');
      expect(folderField()).toBe('/work/a');
      await rename('ab');
      expect(folderField()).toBe('/work/ab');
    });

    it('starts from the folder that was typed by hand', async () => {
      await withName(apiOf({ project: byFolder() }));
      await page!.get('input[name="folder"]').setValue('/home/dev/old-name');

      await rename('new-name');

      expect(folderField()).toBe('/home/dev/new-name');
    });

    it('follows the separator of Windows', async () => {
      await withName(apiOf({ project: byFolder() }));
      await page!.get('input[name="folder"]').setValue('C:\\work\\shop');

      await rename('my-app');

      expect(folderField()).toBe('C:\\work\\my-app');
    });

    it('previews in the folder that is shown, and not in the one that was loaded', async () => {
      const api = apiOf({ project: byFolder() });
      await withName(api);

      await rename('my-app');
      await preview();

      expect(api.preview).toHaveBeenCalledWith(expect.objectContaining({ projectFolder: '/work/my-app' }));
    });

    it('previews in a folder that was typed by hand without loading it', async () => {
      const api = apiOf({ project: byFolder() });
      await withName(api);
      await page!.get('input[name="folder"]').setValue('/work/typed');

      await preview();

      expect(api.preview).toHaveBeenCalledWith(expect.objectContaining({ projectFolder: '/work/typed' }));
    });

    it('loads the project of the new folder once the typing pauses, not at every key', async () => {
      const api = apiOf({ project: byFolder() });
      await withName(api);
      expect(api.project).toHaveBeenCalledTimes(1);

      await rename('a');
      await vi.advanceTimersByTimeAsync(200);
      await rename('ab');
      await vi.advanceTimersByTimeAsync(299);
      expect(api.project).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();

      expect(api.project).toHaveBeenCalledTimes(2);
      expect(api.project).toHaveBeenLastCalledWith('/work/ab');
    });

    it('shows what the project of the new folder has, in place of what the old one had', async () => {
      await withName(apiOf({ project: byFolder() }));
      expect(node('module:typescript').text()).toContain('Applied');

      await rename('my-app');
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();

      expect(node('module:typescript').text()).not.toContain('Applied');
    });

    it('keeps the name that was typed when the new folder proposes another', async () => {
      const proposing: ProjectState = {
        projectFolder: '/work/my-app',
        applied: [],
        presets: { init: { projectName: 'old' } },
      };
      await withName(apiOf({ project: byFolder({ '/work/my-app': proposing }) }));

      await rename('my-app');
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();

      expect(page!.get<HTMLInputElement>('#option-projectName').element.value).toBe('my-app');
      expect(folderField()).toBe('/work/my-app');
    });

    it.each(['', '   ', '..', 'a/b'])('leaves the folder alone for the name "%s"', async (name) => {
      const api = apiOf({ project: byFolder() });
      await withName(api);

      await rename(name);
      await vi.advanceTimersByTimeAsync(500);
      await flushPromises();

      expect(folderField()).toBe('/work/shop');
      expect(api.project).toHaveBeenCalledTimes(1);
    });

    it('does not load again a folder that did not change', async () => {
      const api = apiOf({ project: byFolder() });
      await withName(api);

      await rename('shop');
      await vi.advanceTimersByTimeAsync(500);
      await flushPromises();

      expect(api.project).toHaveBeenCalledTimes(1);
    });

    it('does not move the folder when another option is changed', async () => {
      const api = apiOf({ project: byFolder() });
      await open(api);
      await addFromDetails('fastify-server');
      await addFromDetails('init');

      await page!.get('#option-serverPort').setValue('4100');
      await vi.advanceTimersByTimeAsync(500);

      expect(folderField()).toBe('/work/shop');
      expect(api.project).toHaveBeenCalledTimes(1);
    });

    it('does not touch the name when the folder is typed', async () => {
      await withName(apiOf({ project: byFolder() }));

      await page!.get('input[name="folder"]').setValue('/work/another-name');

      expect(page!.get<HTMLInputElement>('#option-projectName').element.value).toBe('shop');
    });

    it('does not load anything once the page is gone', async () => {
      const api = apiOf({ project: byFolder() });
      await withName(api);
      await rename('my-app');

      page!.unmount();
      await vi.advanceTimersByTimeAsync(500);

      expect(api.project).toHaveBeenCalledTimes(1);
    });

    it('says what is wrong with the new folder', async () => {
      const api = apiOf({
        project: vi.fn(async (folder?: string) => {
          if (folder === undefined) return here;
          throw new ApiError('cannot access /work/my-app: permission denied (EACCES)', 422);
        }),
      });
      await withName(api);

      await rename('my-app');
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();

      expect(page!.get('header [role="alert"]').text()).toContain('permission denied');
    });

    it('does not show the failure of a folder that is no longer the one on screen', async () => {
      const failures: Record<string, (error: Error) => void> = {};
      const api = apiOf({
        project: vi.fn((folder?: string) =>
          folder === undefined
            ? Promise.resolve(here)
            : folder === '/work/a'
              ? new Promise<ProjectState>((_resolve, reject) => (failures[folder] = reject))
              : Promise.resolve(typed),
        ),
      });
      await withName(api);

      await rename('a');
      await vi.advanceTimersByTimeAsync(300);
      await rename('ab');
      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();
      failures['/work/a']?.(new Error('late failure'));
      await flushPromises();

      expect(page!.find('header [role="alert"]').exists()).toBe(false);
    });

    it('keeps the answer of the last folder when answers come in another order', async () => {
      const answers: Record<string, (state: ProjectState) => void> = {};
      const api = apiOf({
        project: vi.fn((folder?: string) =>
          folder === undefined
            ? Promise.resolve(here)
            : new Promise<ProjectState>((resolve) => (answers[folder] = resolve)),
        ),
      });
      await withName(api);

      await rename('a');
      await vi.advanceTimersByTimeAsync(300);
      await rename('ab');
      await vi.advanceTimersByTimeAsync(300);
      answers['/work/ab']?.({
        projectFolder: '/work/ab',
        applied: [{ slug: 'prettier', appliedAt: 'x' }],
        presets: {},
      });
      await flushPromises();
      answers['/work/a']?.({ projectFolder: '/work/a', applied: [], presets: {} });
      await flushPromises();

      expect(node('module:prettier').text()).toContain('Applied');
    });
  });

  describe('Given another folder', () => {
    const other: ProjectState = {
      projectFolder: '/work/other',
      applied: [{ slug: 'init', appliedAt: '2026-10-20T10:00:00.000Z' }],
      presets: { init: { projectName: 'other' }, 'fastify-server': { serverPort: 5000 } },
    };
    const load = async (folder: string) => {
      await page!.get('input[name="folder"]').setValue(folder);
      await page!.get('form.folder').trigger('submit');
      await flushPromises();
    };

    it('loads the project of the folder that is typed', async () => {
      const api = apiOf({ project: vi.fn(async (folder?: string) => (folder === undefined ? project : other)) });
      await open(api);

      await load('/work/other');

      expect(api.project).toHaveBeenLastCalledWith('/work/other');
      expect(page!.get<HTMLInputElement>('input[name="folder"]').element.value).toBe('/work/other');
      expect(node('module:init').text()).toContain('Applied');
    });

    it('takes out of the basket what the project of that folder already has, and keeps the rest', async () => {
      const api = apiOf({ project: vi.fn(async (folder?: string) => (folder === undefined ? project : other)) });
      await open(api);
      await addFromDetails('vitest');

      await load('/work/other');

      expect(basketItems()).toEqual(['typescript', 'vitest']);
    });

    it('completes the basket with what that project lacks: what the other one had may not be there', async () => {
      const empty: ProjectState = { projectFolder: '/work/empty', applied: [], presets: {} };
      const had: ProjectState = {
        ...project,
        applied: [
          { slug: 'init', appliedAt: 'x' },
          { slug: 'typescript', appliedAt: 'x' },
        ],
      };
      const api = apiOf({ project: vi.fn(async (folder?: string) => (folder === undefined ? had : empty)) });
      await open(api);
      await addFromDetails('vitest');
      expect(basketItems()).toEqual(['vitest']);

      await load('/work/empty');

      expect(basketItems()).toEqual(['init', 'typescript', 'vitest']);
      const labelled = page!.findAll('.basket .item').map((item) => item.text().includes('Added automatically'));
      expect(labelled).toEqual([true, true, false]);
      expect(page!.find('.basket .missing').exists()).toBe(false);
    });

    it('does not bring back, for the project it loads, a module that is applied there', async () => {
      const api = apiOf({ project: vi.fn(async (folder?: string) => (folder === undefined ? project : other)) });
      await open(api);
      await addFromDetails('vitest');

      await load('/work/other');

      expect(basketItems()).toEqual(['typescript', 'vitest']);
    });

    it('proposes the values of that project, except for what was typed', async () => {
      const api = apiOf({ project: vi.fn(async (folder?: string) => (folder === undefined ? project : other)) });
      await open(api);
      await addFromDetails('fastify-server');
      await page!.get('#option-serverPort').setValue('4100');

      await load('/work/other');

      expect(page!.get<HTMLInputElement>('#option-serverPort').element.value).toBe('4100');
      expect(page!.find('#option-projectName').exists()).toBe(false);
    });

    it('forgets the answer, since it was for another folder', async () => {
      const api = apiOf({ project: vi.fn(async (folder?: string) => (folder === undefined ? project : other)) });
      await open(api);
      await addFromDetails('prettier');
      await preview();

      await load('/work/other');

      expect(page!.find('.result').exists()).toBe(false);
    });

    it('says what is wrong with the folder, and keeps the project that is shown', async () => {
      const api = apiOf({
        project: vi.fn(async (folder?: string) => {
          if (folder !== 'relative/folder') return project;
          throw new ApiError('the folder must be an absolute path', 400);
        }),
      });
      await open(api);

      await load('relative/folder');

      expect(page!.get('header [role="alert"]').text()).toContain('the folder must be an absolute path');
      expect(node('module:init').text()).not.toContain('Applied');
      await load('/work/shop');
      expect(page!.find('header [role="alert"]').exists()).toBe(false);
    });

    it("shows a failure that is not the server's answer", async () => {
      const api = apiOf({
        project: vi.fn(async (folder?: string) => {
          if (folder === undefined) return project;
          throw new TypeError('Failed to fetch');
        }),
      });
      await open(api);

      await load('/work/other');

      expect(page!.get('header [role="alert"]').text()).toContain('Failed to fetch');
    });
  });
});
