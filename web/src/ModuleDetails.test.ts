import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ModuleDetails from './ModuleDetails.vue';
import type { ModuleInfo } from './types';

const server: ModuleInfo = {
  slug: 'fastify-server',
  group: 'Server',
  description: 'Adds a Fastify server with a health endpoint',
  dependsOn: ['typescript', 'vitest'],
  tags: ['server', 'backend'],
  properties: [
    { key: 'serverPort', type: 'number', mandatory: false, description: 'HTTP port of the server' },
    { key: 'owner', type: 'string', mandatory: true, description: 'Owner of the server' },
  ],
};
const plain: ModuleInfo = {
  slug: 'init',
  group: 'Init',
  description: 'Initializes',
  dependsOn: [],
  tags: [],
  properties: [],
};

type Props = InstanceType<typeof ModuleDetails>['$props'];
const show = (props: Partial<Props> = {}) =>
  mount(ModuleDetails, {
    props: {
      module: server,
      applied: new Set<string>(),
      inBasket: new Set<string>(),
      alsoAdds: [],
      ...props,
    },
  });

describe('details of a module', () => {
  it('asks to choose a module while none is', () => {
    const page = show({ module: undefined });

    expect(page.text()).toContain('Choose a module to see');
    expect(page.find('button').exists()).toBe(false);
  });

  it('shows what the module is: name, group, description and tags', () => {
    const page = show();

    expect(page.get('h2').text()).toBe('fastify-server');
    expect(page.text()).toContain('Server');
    expect(page.text()).toContain('Adds a Fastify server with a health endpoint');
    expect(page.findAll('.tag').map((tag) => tag.text())).toEqual(['server', 'backend']);
  });

  it('does not show tags when there are none', () => {
    expect(show({ module: plain }).find('.tag').exists()).toBe(false);
  });

  it('lists the prerequisites with what each is for the project', () => {
    const page = show({ applied: new Set(['typescript']) });

    const needs = page.findAll('.need').map((need) => [need.attributes('data-status'), need.text()]);
    expect(needs).toEqual([
      ['applied', expect.stringContaining('typescript')],
      ['missing', expect.stringContaining('vitest')],
    ]);
    expect(page.find('.need[data-status="applied"]').text()).toContain('applied');
    expect(page.find('.need[data-status="missing"]').text()).toContain('missing');
  });

  it('counts a prerequisite that is in the basket as provided', () => {
    const page = show({ inBasket: new Set(['vitest']) });

    expect(page.find('.need[data-status="in-basket"]').text()).toContain('in basket');
  });

  it('says so when the module needs nothing', () => {
    const page = show({ module: plain });

    expect(page.text()).toContain('Needs nothing');
    expect(page.find('.need').exists()).toBe(false);
  });

  it('lists the options, which one is required, and their type', () => {
    const page = show();

    const options = page
      .findAll('li')
      .filter((item) => item.find('.type').exists())
      .map((option) => option.text());
    expect(options).toEqual([expect.stringContaining('serverPort'), expect.stringContaining('owner')]);
    expect(options[0]).toContain('number');
    expect(options[0]).toContain('HTTP port of the server');
    expect(options[0]).not.toContain('required');
    expect(options[1]).toContain('required');
  });

  it('says so when the module has no option', () => {
    expect(show({ module: plain }).text()).toContain('No option');
  });

  describe('Given a module the project does not have', () => {
    it('offers to put it in the basket, and says what comes with it', async () => {
      const page = show({ alsoAdds: ['typescript', 'vitest'] });

      expect(page.get('button').text()).toBe('Add to basket');
      expect(page.get('.also').text()).toContain('typescript, vitest');
      await page.get('button').trigger('click');
      expect(page.emitted('toggle')).toEqual([['fastify-server']]);
    });

    it('does not announce anything when nothing comes with it', () => {
      expect(show({ alsoAdds: [] }).find('.also').exists()).toBe(false);
    });
  });

  describe('Given a module that is in the basket', () => {
    it('offers to take it out, without announcing what comes with it', async () => {
      const page = show({ inBasket: new Set(['fastify-server']), alsoAdds: ['typescript'] });

      expect(page.get('button').text()).toBe('Remove from basket');
      expect(page.find('.also').exists()).toBe(false);
      await page.get('button').trigger('click');
      expect(page.emitted('toggle')).toEqual([['fastify-server']]);
    });
  });

  describe('Given a module the project already has', () => {
    it('says so and offers nothing', () => {
      const page = show({ applied: new Set(['fastify-server']) });

      expect(page.text()).toContain('already applied');
      expect(page.find('button').exists()).toBe(false);
    });
  });
});
