import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import ModuleTree from './ModuleTree.vue';
import type { ModuleInfo } from './types';

const mod = (slug: string, dependsOn: string[] = []): ModuleInfo => ({
  slug,
  group: '',
  description: `Adds ${slug}`,
  dependsOn,
  tags: [],
  properties: [],
});

const groups = [
  { name: 'Init', modules: [mod('init')] },
  { name: 'Tests', modules: [mod('vitest', ['typescript', 'init'])] },
  { name: 'Quality', modules: [mod('prettier', ['init']), mod('eslint', ['typescript', 'ghost'])] },
];

describe('tree of the modules', () => {
  let wrapper: VueWrapper | undefined;
  afterEach(() => wrapper?.unmount());

  const show = (props: Partial<InstanceType<typeof ModuleTree>['$props']> = {}) => {
    wrapper = mount(ModuleTree, {
      attachTo: document.body,
      props: { groups, applied: new Set<string>(), inBasket: new Set<string>(), selected: undefined, ...props },
    });
    return wrapper;
  };
  const items = (page: VueWrapper) => page.findAll('[role="treeitem"]');
  const item = (page: VueWrapper, key: string) => page.get(`[data-key="${key}"]`);
  const focused = () => (document.activeElement as HTMLElement | null)?.dataset['key'];
  const press = async (page: VueWrapper, key: string, from: string) => {
    await item(page, from).trigger('keydown', { key });
  };

  describe('structure', () => {
    it('is a tree named Modules, whose first level is the groups and second the modules', () => {
      const page = show();

      expect(page.get('[role="tree"]').attributes('aria-label')).toBe('Modules');
      expect(
        items(page)
          .filter((node) => node.attributes('aria-level') === '1')
          .map((node) => node.attributes('data-key')),
      ).toEqual(['group:Init', 'group:Tests', 'group:Quality']);
      expect(items(page).filter((node) => node.attributes('aria-level') === '2')).toHaveLength(4);
      expect(item(page, 'group:Quality').find('[role="group"]').exists()).toBe(true);
    });

    it('has every group open to begin with, and says so', () => {
      const page = show();

      for (const group of ['Init', 'Tests', 'Quality']) {
        expect(item(page, `group:${group}`).attributes('aria-expanded')).toBe('true');
      }
    });

    it('has only one stop for the Tab key: the first group', () => {
      const page = show();

      expect(
        items(page)
          .filter((node) => node.attributes('tabindex') === '0')
          .map((node) => node.attributes('data-key')),
      ).toEqual(['group:Init']);
      expect(items(page).every((node) => ['0', '-1'].includes(node.attributes('tabindex') ?? ''))).toBe(true);
    });

    it('shows the name and the description of each module', () => {
      const page = show();

      expect(item(page, 'module:prettier').text()).toContain('prettier');
      expect(item(page, 'module:prettier').text()).toContain('Adds prettier');
    });
  });

  describe('state of a module', () => {
    it('tells in words that a module is applied or in the basket, and nothing for the others', () => {
      const page = show({ applied: new Set(['init']), inBasket: new Set(['vitest']) });

      expect(item(page, 'module:init').text()).toContain('Applied');
      expect(item(page, 'module:vitest').text()).toContain('In basket');
      expect(item(page, 'module:prettier').text()).not.toMatch(/Applied|In basket/);
    });

    it('marks the module selected', () => {
      const page = show({ selected: 'prettier' });

      expect(item(page, 'module:prettier').attributes('aria-selected')).toBe('true');
      expect(item(page, 'module:eslint').attributes('aria-selected')).toBe('false');
    });
  });

  describe('prerequisites', () => {
    it('are listed with what each is for the project: applied, in the basket or missing', () => {
      const page = show({ applied: new Set(['init']), inBasket: new Set(['typescript']) });

      const needs = item(page, 'module:eslint')
        .findAll('.need')
        .map((need) => [need.attributes('data-status'), need.text()]);
      expect(needs).toEqual([
        ['in-basket', expect.stringContaining('typescript')],
        ['missing', expect.stringContaining('ghost')],
      ]);
      expect(item(page, 'module:eslint').find('.need[data-status="in-basket"]').text()).toContain('in basket');
      expect(item(page, 'module:eslint').find('.need[data-status="missing"]').text()).toContain('missing');
      expect(item(page, 'module:vitest').find('.need[data-status="applied"]').text()).toContain('applied');
    });

    it('are not shown for a module that needs nothing', () => {
      const page = show();

      expect(item(page, 'module:init').find('.need').exists()).toBe(false);
    });
  });

  describe('with the mouse', () => {
    it('selects the module that is clicked', async () => {
      const page = show();

      await item(page, 'module:eslint').trigger('click');

      expect(page.emitted('select')).toEqual([['eslint']]);
    });

    it('does not select the group of the module that is clicked', async () => {
      const page = show();

      await item(page, 'module:eslint').trigger('click');

      expect(item(page, 'group:Quality').attributes('aria-expanded')).toBe('true');
    });

    it('closes and opens a group when its name is clicked', async () => {
      const page = show();

      await item(page, 'group:Quality').get('.group-name').trigger('click');
      expect(item(page, 'group:Quality').attributes('aria-expanded')).toBe('false');
      expect(page.find('[data-key="module:eslint"]').exists()).toBe(false);

      await item(page, 'group:Quality').get('.group-name').trigger('click');
      expect(item(page, 'group:Quality').attributes('aria-expanded')).toBe('true');
      expect(page.find('[data-key="module:eslint"]').exists()).toBe(true);
    });
  });

  describe('with the keyboard', () => {
    it('goes down and up through what is visible', async () => {
      const page = show();

      await press(page, 'ArrowDown', 'group:Init');
      expect(focused()).toBe('module:init');
      await press(page, 'ArrowDown', 'module:init');
      expect(focused()).toBe('group:Tests');
      await press(page, 'ArrowUp', 'group:Tests');
      expect(focused()).toBe('module:init');
    });

    it('stays where it is at both ends', async () => {
      const page = show();

      await press(page, 'ArrowUp', 'group:Init');
      expect(focused()).toBe('group:Init');
      await press(page, 'ArrowDown', 'module:eslint');
      expect(focused()).toBe('module:eslint');
    });

    it('goes to the first and the last', async () => {
      const page = show();

      await press(page, 'End', 'group:Init');
      expect(focused()).toBe('module:eslint');
      await press(page, 'Home', 'module:eslint');
      expect(focused()).toBe('group:Init');
    });

    it('skips the modules of a group that is closed', async () => {
      const page = show();
      await item(page, 'group:Tests').get('.group-name').trigger('click');

      await press(page, 'ArrowDown', 'module:init');
      expect(focused()).toBe('group:Tests');
      await press(page, 'ArrowDown', 'group:Tests');
      expect(focused()).toBe('group:Quality');
    });

    it('opens a closed group with the right arrow, then goes into it', async () => {
      const page = show();
      await item(page, 'group:Tests').get('.group-name').trigger('click');

      await press(page, 'ArrowRight', 'group:Tests');
      expect(item(page, 'group:Tests').attributes('aria-expanded')).toBe('true');
      expect(focused()).not.toBe('module:vitest');

      await press(page, 'ArrowRight', 'group:Tests');
      expect(focused()).toBe('module:vitest');
    });

    it('does nothing with the right arrow on a module', async () => {
      const page = show();

      await press(page, 'ArrowRight', 'module:init');

      expect(page.emitted('select')).toBeUndefined();
      expect(items(page)).toHaveLength(7);
    });

    it('goes to the group of a module with the left arrow, and closes an open group with it', async () => {
      const page = show();

      await press(page, 'ArrowLeft', 'module:eslint');
      expect(focused()).toBe('group:Quality');
      await press(page, 'ArrowLeft', 'group:Quality');
      expect(item(page, 'group:Quality').attributes('aria-expanded')).toBe('false');
      await press(page, 'ArrowLeft', 'group:Quality');
      expect(item(page, 'group:Quality').attributes('aria-expanded')).toBe('false');
    });

    it('selects the module on Enter, and opens or closes the group', async () => {
      const page = show();

      await press(page, 'Enter', 'module:prettier');
      expect(page.emitted('select')).toEqual([['prettier']]);

      await press(page, 'Enter', 'group:Quality');
      expect(item(page, 'group:Quality').attributes('aria-expanded')).toBe('false');
    });

    it('puts a module in the basket, or takes it out, on Space', async () => {
      const page = show();

      await press(page, ' ', 'module:prettier');

      expect(page.emitted('toggle')).toEqual([['prettier']]);
    });

    it('does not put in the basket a module that is already applied', async () => {
      const page = show({ applied: new Set(['init']) });

      await press(page, ' ', 'module:init');

      expect(page.emitted('toggle')).toBeUndefined();
    });

    it('opens or closes a group on Space', async () => {
      const page = show();

      await press(page, ' ', 'group:Init');

      expect(item(page, 'group:Init').attributes('aria-expanded')).toBe('false');
    });

    it('leaves the other keys alone', async () => {
      const page = show();
      const before = focused();

      await press(page, 'a', 'group:Init');
      await press(page, 'Tab', 'group:Init');

      expect(focused()).toBe(before);
      expect(page.emitted('select')).toBeUndefined();
      expect(page.emitted('toggle')).toBeUndefined();
    });

    it('keeps the arrows and Space from scrolling the page', async () => {
      const page = show();

      const events = [
        new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true, bubbles: true }),
        new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true }),
        new KeyboardEvent('keydown', { key: 'a', cancelable: true, bubbles: true }),
      ];
      for (const event of events) item(page, 'module:init').element.dispatchEvent(event);

      expect(events.map((event) => event.defaultPrevented)).toEqual([true, true, false]);
    });

    it('is the one stop for the Tab key wherever the focus has moved to', async () => {
      const page = show();

      await press(page, 'ArrowDown', 'group:Init');

      expect(
        items(page)
          .filter((node) => node.attributes('tabindex') === '0')
          .map((node) => node.attributes('data-key')),
      ).toEqual(['module:init']);
    });

    it('moves the stop for the Tab key to a module that is clicked', async () => {
      const page = show();

      await item(page, 'module:eslint').trigger('click');

      expect(
        items(page)
          .filter((node) => node.attributes('tabindex') === '0')
          .map((node) => node.attributes('data-key')),
      ).toEqual(['module:eslint']);
    });
  });
});
