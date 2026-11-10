import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { COLUMN_GAP, NODE_WIDTH, PADDING } from './graph';
import PrerequisiteGraph from './PrerequisiteGraph.vue';
import type { ModuleInfo } from './types';

const mod = (slug: string, ...dependsOn: string[]): ModuleInfo => ({
  slug,
  group: 'Group',
  description: `Adds ${slug}`,
  dependsOn,
  tags: [],
  properties: [],
});

const modules: readonly ModuleInfo[] = [
  mod('init'),
  mod('typescript', 'init'),
  mod('vitest', 'typescript'),
  mod('fastify-server', 'typescript', 'vitest'),
  mod('config', 'fastify-server'),
  mod('docker', 'fastify-server', 'config'),
  mod('prettier', 'init'),
];

/** Every module is applied: every module is shown, whatever it needs. The tests that look at the nodes start here. */
const everything = new Set(modules.map(({ slug }) => slug));

type Props = InstanceType<typeof PrerequisiteGraph>['$props'];
const show = (props: Partial<Props> = {}) =>
  mount(PrerequisiteGraph, {
    props: { modules, applied: everything, inBasket: new Set<string>(), selected: undefined, ...props },
  });
const node = (page: ReturnType<typeof show>, slug: string) => page.get(`[data-slug="${slug}"]`);

describe('graph of the prerequisites', () => {
  describe('nodes', () => {
    it('has a button for each module, in the order of the levels', () => {
      const page = show();

      expect(page.findAll('button.node').map((button) => button.get('.name').text())).toEqual([
        'init',
        'typescript',
        'prettier',
        'vitest',
        'fastify-server',
        'config',
        'docker',
      ]);
      expect(page.findAll('button.node').every((button) => button.attributes('type') === 'button')).toBe(true);
    });

    it('puts each module in the column of its level', () => {
      const page = show();

      expect(node(page, 'init').attributes('data-level')).toBe('0');
      expect(node(page, 'fastify-server').attributes('data-level')).toBe('3');
      expect(node(page, 'docker').attributes('data-level')).toBe('5');
      expect((node(page, 'docker').element as HTMLElement).style.left).toBe(
        `${PADDING + 5 * (NODE_WIDTH + COLUMN_GAP)}px`,
      );
    });

    it('is as large as its layout, to scroll when the page is narrower', () => {
      const canvas = show().get('.canvas').element as HTMLElement;

      expect(canvas.style.width).toBe(`${2 * PADDING + 6 * NODE_WIDTH + 5 * COLUMN_GAP}px`);
    });

    it('says what the project has and what the basket holds, in words', () => {
      const page = show({ applied: new Set(['init']), inBasket: new Set(['typescript']) });

      expect(node(page, 'init').attributes('data-state')).toBe('applied');
      expect(node(page, 'init').get('.state').text()).toBe('Applied');
      expect(node(page, 'typescript').attributes('data-state')).toBe('in-basket');
      expect(node(page, 'typescript').get('.state').text()).toBe('In basket');
      expect(node(page, 'vitest').attributes('data-state')).toBe('available');
      expect(node(page, 'vitest').find('.state').exists()).toBe(false);
    });

    it('lists, for a screen reader, what the module needs and which modules need it', () => {
      const page = show();

      const description = (slug: string) => page.get(`#${node(page, slug).attributes('aria-describedby')}`).text();
      expect(description('fastify-server')).toBe('Needs typescript, vitest. Needed by config, docker.');
      expect(description('init')).toBe('Needs nothing. Needed by typescript, prettier.');
      expect(description('docker')).toBe('Needs fastify-server, config. Needed by nothing.');
    });

    it('asks to choose the module when it is pressed', async () => {
      const page = show();

      await node(page, 'vitest').trigger('click');

      expect(page.emitted('select')).toEqual([['vitest']]);
    });
  });

  describe('links', () => {
    const links = (page: ReturnType<typeof show>) =>
      page.findAll('path.edge').map((edge) => `${edge.attributes('data-from')}>${edge.attributes('data-to')}`);

    it('draws the direct prerequisites only: a module also needs what its prerequisites need', () => {
      expect(links(show()).sort()).toEqual(
        [
          'init>typescript',
          'init>prettier',
          'typescript>vitest',
          'vitest>fastify-server',
          'fastify-server>config',
          'config>docker',
        ].sort(),
      );
    });

    it('says in a sentence what they show', () => {
      expect(show().get('.note').text()).toContain('direct prerequisites');
    });

    it('is not for a screen reader, which has the lists of each module', () => {
      const svg = show().get('svg');

      expect(svg.attributes('aria-hidden')).toBe('true');
      expect(svg.attributes('focusable')).toBe('false');
    });

    it('goes from a module to the modules that need it, with an arrow', () => {
      const edge = show().get('path.edge');

      expect(edge.attributes('marker-end')).toMatch(/^url\(#.+\)$/);
      expect(edge.attributes('d')).toMatch(/^M [\d.]+ [\d.]+ C /);
    });
  });

  describe('when a module is chosen', () => {
    it('is marked as the current one, and nothing else is', () => {
      const page = show({ selected: 'fastify-server' });

      expect(
        page
          .findAll('button.node')
          .filter((button) => button.attributes('aria-current') === 'true')
          .map((button) => button.attributes('data-slug')),
      ).toEqual(['fastify-server']);
    });

    it('names, for a screen reader, what it needs and what needs it, through the chain', () => {
      const page = show({ selected: 'fastify-server' });

      const relations = Object.fromEntries(
        page
          .findAll('button.node')
          .map((button) => [
            button.attributes('data-slug'),
            button.find('.relation').exists() ? button.get('.relation').text() : '',
          ]),
      );
      expect(relations).toEqual({
        init: 'prerequisite',
        typescript: 'prerequisite',
        vitest: 'prerequisite',
        'fastify-server': '',
        config: 'needs it',
        docker: 'needs it',
        prettier: '',
      });
      expect(node(page, 'init').attributes('data-relation')).toBe('prerequisite');
      expect(node(page, 'docker').attributes('data-relation')).toBe('dependent');
      expect(node(page, 'fastify-server').attributes('data-relation')).toBe('selected');
      expect(node(page, 'prettier').attributes('data-relation')).toBe('unrelated');
    });

    it('highlights the links of the chain, in both directions, and leaves the others', () => {
      const page = show({ selected: 'fastify-server' });

      const chain = Object.fromEntries(
        page
          .findAll('path.edge')
          .map((edge) => [
            `${edge.attributes('data-from')}>${edge.attributes('data-to')}`,
            edge.attributes('data-chain'),
          ]),
      );
      expect(chain).toEqual({
        'init>typescript': 'prerequisites',
        'typescript>vitest': 'prerequisites',
        'vitest>fastify-server': 'prerequisites',
        'fastify-server>config': 'dependents',
        'config>docker': 'dependents',
        'init>prettier': 'unrelated',
      });
    });

    it('uses the arrow of the highlighted links for them', () => {
      const page = show({ selected: 'fastify-server' });

      const marker = (from: string, to: string) =>
        page.get(`path.edge[data-from="${from}"][data-to="${to}"]`).attributes('marker-end');
      expect(marker('typescript', 'vitest')).toBe(marker('config', 'docker'));
      expect(marker('typescript', 'vitest')).not.toBe(marker('init', 'prettier'));
    });

    it('does nothing to the nodes and the links when no module is chosen', () => {
      const page = show();

      expect(page.findAll('.relation')).toHaveLength(0);
      expect(page.findAll('button.node').every((button) => button.attributes('data-relation') === 'none')).toBe(true);
      expect(page.findAll('path.edge').every((edge) => edge.attributes('data-chain') === 'none')).toBe(true);
      expect(page.findAll('[aria-current]')).toHaveLength(0);
    });

    it('keeps the state of the modules beside what they are to the one that is chosen', () => {
      const page = show({ selected: 'config', applied: new Set(['init']), inBasket: new Set(['typescript']) });

      expect(node(page, 'init').text()).toContain('Applied');
      expect(node(page, 'init').text()).toContain('prerequisite');
      expect(node(page, 'typescript').text()).toContain('In basket');
    });
  });

  describe('what is shown', () => {
    const shown = (page: ReturnType<typeof show>) => page.findAll('button.node').map((b) => b.attributes('data-slug'));

    it('is only what needs nothing when the project has nothing and the basket is empty', () => {
      const page = show({ applied: new Set() });

      expect(shown(page)).toEqual(['init']);
      expect(page.findAll('path.edge')).toHaveLength(0);
    });

    it('gains a module when everything it needs is applied or in the basket', () => {
      expect(shown(show({ applied: new Set(['init']) }))).toEqual(['init', 'typescript', 'prettier']);
      expect(shown(show({ applied: new Set(), inBasket: new Set(['init']) }))).toEqual([
        'init',
        'typescript',
        'prettier',
      ]);
      expect(shown(show({ applied: new Set(['init']), inBasket: new Set(['typescript']) }))).toEqual([
        'init',
        'typescript',
        'prettier',
        'vitest',
      ]);
    });

    it('does not move what is shown when another module appears', () => {
      const before = show({ applied: new Set(['init']) });
      const after = show({ applied: new Set(['init', 'typescript']) });

      for (const slug of ['init', 'typescript', 'prettier']) {
        expect(node(after, slug).attributes('style')).toBe(node(before, slug).attributes('style'));
      }
    });

    it('draws the links between the modules that are shown only', () => {
      const page = show({ applied: new Set(['init', 'typescript']) });

      const links = page
        .findAll('path.edge')
        .map((edge) => `${edge.attributes('data-from')}>${edge.attributes('data-to')}`);
      expect(links.sort()).toEqual(['init>prettier', 'init>typescript', 'typescript>vitest']);
    });

    it('is as wide as the last column that is shown', () => {
      const canvas = show({ applied: new Set(['init']) }).get('.canvas').element as HTMLElement;

      expect(canvas.style.width).toBe(`${2 * PADDING + 2 * NODE_WIDTH + COLUMN_GAP}px`);
    });

    it('says how many modules are waiting for what they need, and what it takes to show them', () => {
      const page = show({ applied: new Set(['init']) });

      const hint = page.get('.waiting');
      expect(hint.attributes('role')).toBe('status');
      expect(hint.text()).toBe('4 more modules appear once what they need is applied or in the basket.');
    });

    it('says it in the singular for one module', () => {
      const page = show({ applied: new Set(['init', 'typescript', 'vitest', 'fastify-server']) });

      expect(page.get('.waiting').text()).toBe('1 more module appears once what it needs is applied or in the basket.');
    });

    it('has nothing to say when every module is shown', () => {
      expect(show().find('.waiting').exists()).toBe(false);
    });

    it('keeps what is in the basket although what it needs is not', () => {
      const page = show({ applied: new Set(['init']), inBasket: new Set(['docker']) });

      expect(shown(page)).toContain('docker');
      expect(node(page, 'docker').attributes('data-state')).toBe('in-basket');
    });

    it('does not mark any module as the current one when the chosen one is not shown', () => {
      const page = show({ applied: new Set(['init']), selected: 'docker' });

      expect(page.findAll('[aria-current]')).toHaveLength(0);
    });
  });

  it('has no node and no link for a catalog without modules', () => {
    const page = show({ modules: [] });

    expect(page.findAll('button.node')).toHaveLength(0);
    expect(page.findAll('path.edge')).toHaveLength(0);
  });
});
