import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ApiError, type Api } from './api';
import App from './App.vue';
import type { Catalog, ProjectState } from './types';

const catalog: Catalog = {
  modules: [
    { slug: 'init', group: 'Init', description: 'Initializes the project', dependsOn: [], tags: [], properties: [] },
    { slug: 'vitest', group: 'Tests', description: 'Adds Vitest', dependsOn: ['typescript'], tags: [], properties: [] },
    {
      slug: 'typescript',
      group: 'TypeScript',
      description: 'Adds TypeScript',
      dependsOn: ['init'],
      tags: [],
      properties: [],
    },
    { slug: 'prettier', group: 'Quality', description: 'Adds Prettier', dependsOn: ['init'], tags: [], properties: [] },
    {
      slug: 'eslint',
      group: 'Quality',
      description: 'Adds ESLint',
      dependsOn: ['typescript'],
      tags: [],
      properties: [],
    },
  ],
};
const project: ProjectState = { projectFolder: '/work/shop', applied: [], presets: {} };

const apiOf = (overrides: Partial<Api> = {}): Api => ({
  catalog: async () => catalog,
  project: async () => project,
  ...overrides,
});

describe('page of the local interface', () => {
  it('asks to open the address crafttype ui printed when it has no token', () => {
    const page = mount(App, { props: { api: undefined } });

    expect(page.get('[role="alert"]').text()).toContain('crafttype ui');
    expect(page.text()).toContain('token');
  });

  it('says it is loading until the server has answered', async () => {
    const page = mount(App, { props: { api: apiOf({ catalog: () => new Promise(() => {}) }) } });

    expect(page.get('[role="status"]').text()).toContain('Loading');
    await flushPromises();
    expect(page.get('[role="status"]').text()).toContain('Loading');
  });

  it('shows the folder of the project', async () => {
    const page = mount(App, { props: { api: apiOf() } });
    await flushPromises();

    expect(page.get('header').text()).toContain('/work/shop');
  });

  it('lists the modules by group, in the order of the catalog', async () => {
    const page = mount(App, { props: { api: apiOf() } });
    await flushPromises();

    const groups = page.findAll('section').map((section) => section.get('h2').text());
    expect(groups).toEqual(['Init', 'Tests', 'TypeScript', 'Quality']);
    const quality = page.findAll('section')[3];
    expect(quality?.findAll('li').map((item) => item.text())).toEqual([
      expect.stringContaining('prettier'),
      expect.stringContaining('eslint'),
    ]);
    expect(quality?.text()).toContain('Adds Prettier');
  });

  it('shows what the server refused, and how to fix it', async () => {
    const refusing = apiOf({
      catalog: async () => {
        throw new ApiError('missing or invalid token', 401, 'send the token printed by crafttype ui');
      },
    });
    const page = mount(App, { props: { api: refusing } });
    await flushPromises();

    const alert = page.get('[role="alert"]').text();
    expect(alert).toContain('missing or invalid token');
    expect(alert).toContain('send the token printed by crafttype ui');
    expect(page.find('section').exists()).toBe(false);
  });

  it("shows a failure that is not the server's answer", async () => {
    const page = mount(App, {
      props: { api: apiOf({ project: async () => Promise.reject(new TypeError('Failed to fetch')) }) },
    });
    await flushPromises();

    expect(page.get('[role="alert"]').text()).toContain('Failed to fetch');
  });
});
