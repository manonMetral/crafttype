import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BasketPanel from './BasketPanel.vue';
import type { SharedProperty } from './basket';

const items = [
  { slug: 'init', auto: true, missing: [] as string[] },
  { slug: 'typescript', auto: true, missing: [] as string[] },
  { slug: 'vitest', auto: false, missing: ['typescript'] },
];
const port: SharedProperty = {
  key: 'serverPort',
  type: 'number',
  mandatory: false,
  description: 'HTTP port',
  usedBy: ['fastify-server', 'vue-app'],
};
const name: SharedProperty = {
  key: 'projectName',
  type: 'string',
  mandatory: true,
  description: 'Project name',
  usedBy: ['init'],
};
const flag: SharedProperty = {
  key: 'verbose',
  type: 'boolean',
  mandatory: false,
  description: 'Talk more',
  usedBy: ['init'],
};

type Props = InstanceType<typeof BasketPanel>['$props'];
const show = (props: Partial<Props> = {}) =>
  mount(BasketPanel, {
    props: { items, properties: [], values: {}, policy: 'fail', loading: false, busy: false, ...props },
  });

describe('basket', () => {
  describe('modules', () => {
    it('lists the modules in the order it is given, with their number', () => {
      const page = show();

      expect(page.findAll('.item .name').map((item) => item.text())).toEqual(['init', 'typescript', 'vitest']);
      expect(page.get('h2').text()).toContain('3');
    });

    it('says which modules were added automatically, and not the ones that were chosen', () => {
      const page = show();

      const labelled = page.findAll('.item').map((item) => item.text().includes('Added automatically'));
      expect(labelled).toEqual([true, true, false]);
    });

    it('warns of a module whose prerequisite is neither applied nor in the basket', () => {
      const page = show();

      const warning = page.findAll('.item')[2]?.get('.missing').text();
      expect(warning).toContain('typescript');
      expect(page.findAll('.missing')).toHaveLength(1);
    });

    it('takes a module out on request, naming it for the screen reader', async () => {
      const page = show();
      const buttons = page.findAll('.item button');

      expect(buttons[2]?.attributes('aria-label')).toBe('Remove vitest from the basket');
      await buttons[2]?.trigger('click');
      expect(page.emitted('remove')).toEqual([['vitest']]);
    });

    it('says what to do while it is empty, and cannot be previewed', () => {
      const page = show({ items: [] });

      expect(page.text()).toContain('Nothing in the basket');
      expect(page.get('h2').text()).toContain('0');
      expect(page.get('button.preview').attributes('disabled')).toBeDefined();
    });
  });

  describe('options', () => {
    it('are not shown when no module of the basket has any', () => {
      expect(show().find('fieldset').exists()).toBe(false);
    });

    it('are asked once each, with what they are for and which modules read them', () => {
      const page = show({ properties: [name, port] });

      const fields = page.findAll('.field');
      expect(fields).toHaveLength(2);
      expect(fields[0]?.text()).toContain('projectName');
      expect(fields[0]?.text()).toContain('required');
      expect(fields[0]?.text()).toContain('Project name');
      expect(fields[1]?.text()).toContain('Used by fastify-server, vue-app');
      expect(fields[1]?.text()).not.toContain('required');
    });

    it('show the value they have, in a field of the right kind', () => {
      const page = show({
        properties: [name, port, flag],
        values: { projectName: 'shop', serverPort: 4100, verbose: true },
      });

      expect(page.get<HTMLInputElement>('#option-projectName').element.value).toBe('shop');
      expect(page.get<HTMLInputElement>('#option-projectName').attributes('type')).toBe('text');
      expect(page.get<HTMLInputElement>('#option-serverPort').element.value).toBe('4100');
      expect(page.get('#option-serverPort').attributes('type')).toBe('number');
      expect(page.get<HTMLInputElement>('#option-verbose').element.checked).toBe(true);
      expect(page.get('#option-verbose').attributes('type')).toBe('checkbox');
    });

    it('are empty when no value is proposed', () => {
      const page = show({ properties: [port] });

      expect(page.get<HTMLInputElement>('#option-serverPort').element.value).toBe('');
    });

    it('are labelled for the screen reader, and linked to their description', () => {
      const page = show({ properties: [port] });

      expect(page.get('label[for="option-serverPort"]').text()).toContain('serverPort');
      expect(page.get('#option-serverPort').attributes('aria-describedby')).toBe('option-serverPort-help');
      expect(page.get('#option-serverPort-help').text()).toContain('HTTP port');
    });

    it('give back the text that is typed', async () => {
      const page = show({ properties: [name] });

      await page.get('#option-projectName').setValue('my-shop');

      expect(page.emitted('update-value')).toEqual([['projectName', 'my-shop']]);
    });

    it('give back a number that is typed as a number, and nothing when it is cleared', async () => {
      const page = show({ properties: [port] });

      await page.get('#option-serverPort').setValue('4100');
      await page.get('#option-serverPort').setValue('');

      expect(page.emitted('update-value')).toEqual([
        ['serverPort', 4100],
        ['serverPort', undefined],
      ]);
    });

    it('give back a box that is ticked or not as a boolean', async () => {
      const page = show({ properties: [flag], values: { verbose: false } });

      await page.get('#option-verbose').setValue(true);
      await page.get('#option-verbose').setValue(false);

      expect(page.emitted('update-value')).toEqual([
        ['verbose', true],
        ['verbose', false],
      ]);
    });
  });

  describe('conflicts', () => {
    it('are settled by one choice for the whole basket, with the one that stops first by default', () => {
      const page = show();

      const options = page.findAll('select option').map((option) => [option.attributes('value'), option.text()]);
      expect(options).toEqual([
        ['fail', expect.stringContaining('Stop')],
        ['skip', expect.stringContaining('Keep')],
        ['overwrite', expect.stringContaining('Replace')],
      ]);
      expect(page.get<HTMLSelectElement>('select').element.value).toBe('fail');
      expect(page.get('label[for="policy"]').text()).toContain('conflict');
    });

    it('give back the choice', async () => {
      const page = show();

      await page.get('select').setValue('overwrite');

      expect(page.emitted('update-policy')).toEqual([['overwrite']]);
    });

    it('show the choice they were given', () => {
      expect(show({ policy: 'skip' }).get<HTMLSelectElement>('select').element.value).toBe('skip');
    });
  });

  describe('preview', () => {
    it('is asked with the button', async () => {
      const page = show();

      await page.get('button.preview').trigger('click');

      expect(page.emitted('preview')).toHaveLength(1);
      expect(page.get('button.preview').text()).toBe('Preview');
    });

    it('cannot be asked again while it is running, and says it is', () => {
      const page = show({ loading: true });

      expect(page.get('button.preview').attributes('disabled')).toBeDefined();
      expect(page.get('button.preview').text()).toBe('Previewing…');
    });

    it('cannot be asked while the basket is being written, and still says Preview', () => {
      const page = show({ busy: true });

      expect(page.get('button.preview').attributes('disabled')).toBeDefined();
      expect(page.get('button.preview').text()).toBe('Preview');
    });
  });
});
