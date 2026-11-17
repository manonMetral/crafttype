import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Api } from './api';
import App from './App.vue';
import type { ApplyResult, BasketPreview, Catalog, ModuleInfo, PreviewRequest, ProjectState, View } from './types';

const mod = (
  slug: string,
  group: string,
  dependsOn: string[] = [],
  properties: ModuleInfo['properties'] = [],
  { requires = [], provides = [] }: { requires?: string[]; provides?: string[] } = {},
): ModuleInfo => ({
  slug,
  group,
  description: `Adds ${slug}`,
  dependsOn,
  requires,
  provides,
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

const appliedResult: ApplyResult = {
  outcome: 'applied',
  projectFolder: '/work/shop',
  steps: [
    {
      slug: 'init',
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
    apply: vi.fn(async (_request: PreviewRequest): Promise<ApplyResult> => appliedResult),
  };
  return Object.assign(api, overrides);
};

describe('page of the local interface', () => {
  let page: VueWrapper | undefined;
  afterEach(() => page?.unmount());

  /**
   * The page opens on the prerequisites. Most of the tests are about the tree by category (the basket, the options, the
   * folder...), so they start there: `view` says which one a test starts from.
   */
  const open = async (api: Api = apiOf(), view: View = 'groups') => {
    page = mount(App, { attachTo: document.body, props: { api } });
    await flushPromises();
    // A page that could not start has no choice of view.
    if (view === 'groups' && page.find('.switch button').exists()) {
      await page.get('.switch button').trigger('click');
    }
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
  const create = async () => {
    await page!.get('button.create').trigger('click');
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

  describe('Given the two views of the modules', () => {
    /** From the tree by category. */
    const showPrerequisites = async () => {
      await page!.findAll('.switch button')[1]!.trigger('click');
    };
    const graphNode = (slug: string) => page!.get(`.graph [data-slug="${slug}"]`);

    it('shows the prerequisites first, with the choice of the other view', async () => {
      await open(apiOf(), 'prerequisites');

      expect(page!.find('.graph').exists()).toBe(true);
      expect(page!.find('[role="tree"]').exists()).toBe(false);
      expect(page!.findAll('.switch button').map((button) => button.attributes('aria-pressed'))).toEqual([
        'false',
        'true',
      ]);
      expect(page!.get('.layout').classes()).toContain('layoutGraph');
    });

    it('shows the modules by category in place of the columns, and back', async () => {
      await open(apiOf(), 'prerequisites');
      expect(page!.findAll('.graph button.node').map((button) => button.attributes('data-slug'))).toEqual(['init']);

      await page!.findAll('.switch button')[0]!.trigger('click');
      expect(page!.find('[role="tree"]').exists()).toBe(true);
      expect(page!.find('.graph').exists()).toBe(false);
      expect(page!.get('.layout').classes()).not.toContain('layoutGraph');

      await showPrerequisites();
      expect(page!.find('.graph').exists()).toBe(true);
      expect(page!.find('[role="tree"]').exists()).toBe(false);
    });

    it('adds the module that is pressed to the basket, and shows its details', async () => {
      await open(
        apiOf({ project: vi.fn(async () => ({ ...project, applied: [{ slug: 'init', appliedAt: 'x' }] })) }),
        'prerequisites',
      );

      await graphNode('typescript').trigger('click');

      expect(basketItems()).toEqual(['typescript']);
      expect(graphNode('typescript').attributes('data-state')).toBe('in-basket');
      expect(page!.get('.details').text()).toContain('typescript');
      expect(page!.get('.details button').text()).toBe('Remove from basket');
      expect(graphNode('typescript').attributes('aria-current')).toBe('true');
      expect(graphNode('init').attributes('data-relation')).toBe('prerequisite');
    });

    it('does not add a module the project has, but shows its details', async () => {
      await open(
        apiOf({ project: vi.fn(async () => ({ ...project, applied: [{ slug: 'init', appliedAt: 'x' }] })) }),
        'prerequisites',
      );

      await graphNode('init').trigger('click');

      expect(basketItems()).toEqual([]);
      expect(page!.get('.details').text()).toContain('This module is already applied');
    });

    it('keeps a module the basket holds when it is pressed again: it is taken out with its Remove button', async () => {
      await open(apiOf(), 'prerequisites');

      await graphNode('init').trigger('click');
      await graphNode('init').trigger('click');

      expect(basketItems()).toEqual(['init']);
      await page!.get('.details button').trigger('click');
      expect(basketItems()).toEqual([]);
    });

    it('keeps the module that was chosen in the tree when the view changes, and back', async () => {
      await open();
      await node('module:init').trigger('click');

      await showPrerequisites();
      expect(graphNode('init').attributes('aria-current')).toBe('true');

      await graphNode('init').trigger('click');
      await graphNode('typescript').trigger('click');
      await page!.findAll('.switch button')[0]!.trigger('click');
      expect(node('module:typescript').attributes('aria-selected')).toBe('true');
    });

    it('shows a module once what it needs is in the basket, and hides it again when that goes', async () => {
      await open(apiOf(), 'prerequisites');
      const shown = () => page!.findAll('.graph button.node').map((button) => button.attributes('data-slug'));
      expect(shown()).toEqual(['init']);

      await graphNode('init').trigger('click');
      expect(shown()).toEqual(['init', 'typescript', 'prettier']);

      await graphNode('typescript').trigger('click');
      expect(shown()).toEqual(['init', 'typescript', 'prettier', 'vitest']);

      await page!.get('.basket .item .remove').trigger('click');
      expect(basketItems()).toEqual(['typescript']);
      expect(shown()).toEqual(['init', 'typescript', 'vitest']);
    });

    it('says how many modules wait for what they need', async () => {
      await open(apiOf(), 'prerequisites');

      expect(page!.get('.waiting').text()).toBe(
        '4 more modules appear once what they need is applied or in the basket.',
      );
    });

    it('shows what the project has and what the basket holds, and follows the basket', async () => {
      await open(
        apiOf({ project: vi.fn(async () => ({ ...project, applied: [{ slug: 'init', appliedAt: 'x' }] })) }),
        'prerequisites',
      );
      expect(graphNode('init').attributes('data-state')).toBe('applied');
      expect(graphNode('typescript').attributes('data-state')).toBe('available');

      await graphNode('typescript').trigger('click');

      expect(graphNode('typescript').attributes('data-state')).toBe('in-basket');
    });

    it('keeps the basket, the options and the preview when the view changes', async () => {
      await open();
      await addFromDetails('init');
      await preview();

      await showPrerequisites();

      expect(basketItems()).toEqual(['init']);
      expect(page!.find('.result').exists()).toBe(true);
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

  describe('Given a basket to apply', () => {
    const afterInit: ProjectState = {
      ...project,
      applied: [{ slug: 'init', appliedAt: '2026-10-20T10:00:00.000Z' }],
    };
    const conflictPreview: BasketPreview = {
      projectFolder: '/work/shop',
      canApply: false,
      steps: [
        {
          slug: 'init',
          outcome: 'conflict',
          report: { created: 0, edited: 0, replaced: 0, unchanged: 0, kept: 0, skipped: 0, conflicts: 1 },
          warnings: [],
          changes: [
            { kind: 'field', target: 'name', decision: 'conflict', description: 'name (existing: "a", module: "b")' },
          ],
        },
      ],
    };
    /** The project as the server tells it: it changes once the basket is written. */
    const writable = (overrides: Partial<Api> = {}) => {
      let written = false;
      return apiOf({
        project: vi.fn(async (_folder?: string) => (written ? afterInit : project)),
        apply: vi.fn(async (_request: PreviewRequest) => {
          written = true;
          return appliedResult;
        }),
        ...overrides,
      });
    };

    it('offers to create the project once the preview says that every module would apply', async () => {
      await open();
      await addFromDetails('init');
      expect(page!.find('button.create').exists()).toBe(false);

      await preview();

      expect(page!.get('button.create').text()).toBe('Create the project');
    });

    it('shows it, but cannot be pressed, when the preview says that the basket cannot apply', async () => {
      const api = apiOf({ preview: vi.fn(async () => conflictPreview) });
      await open(api);
      await addFromDetails('init');
      await preview();

      expect(page!.get('button.create').attributes('disabled')).toBeDefined();
      await page!.get('button.create').trigger('click');
      expect(api.apply).not.toHaveBeenCalled();
    });

    it('offers to add to the project when the project already has modules', async () => {
      await open(apiOf({ project: vi.fn(async () => afterInit) }));
      await addFromDetails('typescript');

      await preview();

      expect(page!.get('button.create').text()).toBe('Add to the project');
    });

    it('writes the basket that was previewed: the same modules, options, policy and folder', async () => {
      const api = writable();
      await open(api);
      await addFromDetails('fastify-server');
      await page!.get('#option-serverPort').setValue('4100');
      await page!.get('select').setValue('skip');
      await preview();

      await create();

      expect(api.apply).toHaveBeenCalledTimes(1);
      expect(api.apply).toHaveBeenCalledWith(vi.mocked(api.preview).mock.calls[0]?.[0]);
    });

    it('shows what it did, in place of the preview', async () => {
      await open(writable());
      await addFromDetails('init');
      await preview();

      await create();

      expect(page!.find('.result').exists()).toBe(false);
      expect(page!.find('button.create').exists()).toBe(false);
      expect(page!.get('.done [role="status"]').text()).toContain('1 module applied');
      expect(page!.get('.done .step').text()).toContain('init');
    });

    it('reads the project again: the tree shows what is applied, and the basket is empty', async () => {
      const api = writable();
      await open(api);
      await addFromDetails('init');
      await preview();

      await create();

      expect(api.project).toHaveBeenLastCalledWith('/work/shop');
      expect(node('module:init').text()).toContain('Applied');
      expect(basketItems()).toEqual([]);
    });

    it('waits for the end of the writing, with the buttons locked meanwhile', async () => {
      let done: (value: ApplyResult) => void = () => {};
      const api = writable({ apply: vi.fn(() => new Promise<ApplyResult>((resolve) => (done = resolve))) });
      await open(api);
      await addFromDetails('init');
      await preview();

      await page!.get('button.create').trigger('click');
      expect(page!.get('button.create').text()).toBe('Creating…');
      expect(page!.get('button.create').attributes('disabled')).toBeDefined();
      expect(page!.get('button.preview').attributes('disabled')).toBeDefined();
      await page!.get('button.create').trigger('click');
      expect(api.apply).toHaveBeenCalledTimes(1);

      done(appliedResult);
      await flushPromises();
      expect(page!.find('.done').exists()).toBe(true);
      expect(page!.get('button.preview').attributes('disabled')).toBeUndefined();
    });

    it('says that nothing was written when the basket can no longer apply, and shows why', async () => {
      const api = apiOf({ apply: vi.fn(async () => ({ outcome: 'refused', preview: conflictPreview }) as const) });
      await open(api);
      await addFromDetails('init');
      await preview();

      await create();

      expect(page!.get('.basketColumn [role="alert"]').text()).toContain('Nothing was written');
      expect(page!.find('.done').exists()).toBe(false);
      expect(page!.get('.result .step').attributes('data-outcome')).toBe('conflict');
      expect(page!.get('button.create').attributes('disabled')).toBeDefined();
    });

    it('shows what the server refused, and that some modules may already be applied', async () => {
      const api = writable({
        apply: vi.fn(async () => {
          throw new ApiError('cannot access /work/shop: permission denied (EACCES)', 422, undefined);
        }),
      });
      await open(api);
      await addFromDetails('init');
      await preview();

      await create();

      const alert = page!.get('.basketColumn [role="alert"]').text();
      expect(alert).toContain('permission denied (EACCES)');
      expect(alert).toContain('may already be applied');
      expect(page!.find('.done').exists()).toBe(false);
    });

    it('says that the server is older than the page when it does not know the request, and that nothing was written', async () => {
      const api = writable({
        apply: vi.fn(async () => {
          throw new ApiError('not found', 404, undefined);
        }),
      });
      await open(api);
      await addFromDetails('init');
      await preview();

      await create();

      const alert = page!.get('.basketColumn [role="alert"]').text();
      expect(alert).toContain('not found');
      expect(alert).toContain('older than this page');
      expect(alert).toContain('start crafttype ui again');
      expect(alert).toContain('Nothing was written');
      expect(alert).not.toContain('may already be applied');
    });

    it('says the same for a preview the server does not know', async () => {
      await open(
        apiOf({
          preview: vi.fn(async () => {
            throw new ApiError('not found', 404, undefined);
          }),
        }),
      );
      await addFromDetails('init');

      await preview();

      expect(page!.get('.basketColumn [role="alert"]').text()).toContain('older than this page');
    });

    it('reads the project again after a failure, since the modules written before it are applied', async () => {
      let attempts = 0;
      const api = apiOf({
        project: vi.fn(async (_folder?: string) => (attempts === 0 ? project : afterInit)),
        apply: vi.fn(async () => {
          attempts += 1;
          throw new ApiError('disk full', 422, undefined);
        }),
      });
      await open(api);
      await addFromDetails('vitest');
      await preview();

      await create();

      expect(api.project).toHaveBeenLastCalledWith('/work/shop');
      expect(node('module:init').text()).toContain('Applied');
      expect(basketItems()).toEqual(['typescript', 'vitest']);
    });

    it("shows a failure that is not the server's answer, and forgets it at the next try", async () => {
      const api = writable({
        apply: vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(appliedResult),
      });
      await open(api);
      await addFromDetails('init');
      await preview();

      await create();
      expect(page!.get('.basketColumn [role="alert"]').text()).toContain('Failed to fetch');
      expect(page!.find('button.create').exists()).toBe(true);

      await create();
      expect(page!.find('.basketColumn [role="alert"]').exists()).toBe(false);
      expect(page!.find('.done').exists()).toBe(true);
    });

    it('keeps the result until a new basket is started', async () => {
      await open(writable());
      await addFromDetails('init');
      await preview();
      await create();

      await node('module:vitest').trigger('click');
      expect(page!.find('.done').exists()).toBe(true);

      await addFromDetails('prettier');
      expect(page!.find('.done').exists()).toBe(false);
    });

    it('does not show the result of a project when the folder shown is another one', async () => {
      const other: ProjectState = { projectFolder: '/work/other', applied: [], presets: {} };
      const api = writable({
        project: vi.fn(async (folder?: string) => (folder === '/work/other' ? other : project)),
      });
      await open(api);
      await addFromDetails('init');
      await preview();
      await create();

      await page!.get('input[name="folder"]').setValue('/work/other');
      await page!.get('form.folder').trigger('submit');
      await flushPromises();

      expect(page!.find('.done').exists()).toBe(false);
    });
  });

  describe('Given modules that provide the same capability', () => {
    /** Two fronts, a module that needs one, and a database that only one module provides. */
    const alternatives: Catalog = {
      modules: [
        mod('init', 'Init'),
        mod('typescript', 'TypeScript', ['init']),
        mod('vitest', 'Tests', ['typescript']),
        mod('sqlite', 'Data', ['typescript'], [], { provides: ['database'] }),
        mod('vue-app', 'Frontend', ['typescript'], [], { provides: ['front'] }),
        mod('react-app', 'Frontend', ['typescript'], [], { provides: ['front'] }),
        mod('fetch-client', 'Frontend', ['vitest'], [], { requires: ['front'] }),
        mod('repository', 'Data', ['vitest'], [], { requires: ['database'] }),
      ],
    };
    const emptyProject: ProjectState = { projectFolder: '/work/shop', applied: [], presets: {} };
    const withVueApp: ProjectState = {
      ...emptyProject,
      applied: ['init', 'typescript', 'vue-app'].map((slug) => ({ slug, appliedAt: 'x' })),
    };
    const alternativesApi = (state: ProjectState = emptyProject) =>
      apiOf({ catalog: vi.fn(async () => alternatives), project: vi.fn(async () => state) });

    it('brings the only module that provides a capability along with the module that requires it', async () => {
      await open(alternativesApi());

      await addFromDetails('repository');

      expect(basketItems()).toEqual(['init', 'typescript', 'vitest', 'sqlite', 'repository']);
    });

    it('leaves the choice to the person when several modules provide it, and says what is missing', async () => {
      await open(alternativesApi());

      await addFromDetails('fetch-client');

      expect(basketItems()).toEqual(['init', 'typescript', 'vitest', 'fetch-client']);
      expect(page!.get('.basket .item .missing').text()).toContain('front: vue-app or react-app');
    });

    it('stops saying it is missing once the person chose one of them', async () => {
      await open(alternativesApi());
      await addFromDetails('fetch-client');

      await addFromDetails('react-app');

      expect(page!.find('.basket .item .missing').exists()).toBe(false);
      expect(node('module:fetch-client').text()).toContain('front: react-app');
    });

    it('does not add a module that the project keeps out, says why, and offers nothing', async () => {
      await open(alternativesApi(withVueApp));

      await node('module:react-app').trigger('click');

      expect(page!.get('.details .excluded').text()).toBe('Cannot be added: front is already provided by vue-app.');
      expect(page!.find('.details button').exists()).toBe(false);
      expect(basketItems()).toEqual([]);
    });

    it('does not add a module that the basket keeps out', async () => {
      await open(alternativesApi());
      await addFromDetails('vue-app');

      await node('module:react-app').trigger('click');

      expect(page!.get('.details .excluded').text()).toContain('already provided by vue-app');
      expect(basketItems()).toEqual(['init', 'typescript', 'vue-app']);
    });

    it('lets the person change their mind: the other module can be added once the first is out', async () => {
      await open(alternativesApi());
      await addFromDetails('vue-app');
      await page!.get('.details button').trigger('click');

      await addFromDetails('react-app');

      expect(basketItems()).toEqual(['init', 'typescript', 'react-app']);
    });

    it('shows both modules in the graph until one is chosen, then only that one', async () => {
      await open(alternativesApi(), 'prerequisites');
      await page!.get('.graph [data-slug="init"]').trigger('click');
      await page!.get('.graph [data-slug="typescript"]').trigger('click');
      const shown = () => page!.findAll('.graph button.node').map((button) => button.attributes('data-slug'));
      expect(shown()).toEqual(expect.arrayContaining(['vue-app', 'react-app']));

      await page!.get('.graph [data-slug="vue-app"]').trigger('click');

      expect(shown()).toContain('vue-app');
      expect(shown()).not.toContain('react-app');
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
