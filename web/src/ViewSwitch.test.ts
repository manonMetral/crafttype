import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ViewSwitch from './ViewSwitch.vue';

const show = (view: 'groups' | 'prerequisites' = 'groups') => mount(ViewSwitch, { props: { view } });

describe('choice of the view of the modules', () => {
  it('offers the two views, as buttons of a labelled group', () => {
    const page = show();

    expect(page.get('[role="group"]').attributes('aria-label')).toBe('View of the modules');
    expect(page.findAll('button').map((button) => button.text())).toEqual(['By category', 'By prerequisites']);
    expect(page.findAll('button').every((button) => button.attributes('type') === 'button')).toBe(true);
  });

  it.each([
    ['groups', ['true', 'false']],
    ['prerequisites', ['false', 'true']],
  ] as const)('says which one is shown when it is %s', (view, pressed) => {
    expect(
      show(view)
        .findAll('button')
        .map((button) => button.attributes('aria-pressed')),
    ).toEqual(pressed);
  });

  it('asks for the view that is pressed', async () => {
    const page = show();

    await page.findAll('button')[1]!.trigger('click');
    await page.findAll('button')[0]!.trigger('click');

    expect(page.emitted('update:view')).toEqual([['prerequisites'], ['groups']]);
  });
});
