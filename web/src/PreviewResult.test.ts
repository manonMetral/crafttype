import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PreviewResult from './PreviewResult.vue';
import type { BasketPreview, ReportInfo, StepInfo } from './types';

const report = (overrides: Partial<ReportInfo> = {}): ReportInfo => ({
  created: 0,
  edited: 0,
  replaced: 0,
  unchanged: 0,
  kept: 0,
  skipped: 0,
  conflicts: 0,
  ...overrides,
});

const ready: StepInfo = {
  slug: 'init',
  outcome: 'ready',
  report: report({ created: 2, edited: 1, unchanged: 3 }),
  warnings: [],
  changes: [
    { kind: 'file', target: 'README.md', decision: 'create', description: 'README.md' },
    { kind: 'edit', target: 'src/server/main.ts', decision: 'edit', description: 'src/server/main.ts' },
    { kind: 'file', target: '.gitignore', decision: 'unchanged', description: '.gitignore' },
  ],
};
const conflict: StepInfo = {
  slug: 'typescript',
  outcome: 'conflict',
  report: report({ conflicts: 1 }),
  warnings: [],
  changes: [
    {
      kind: 'field',
      target: 'name',
      decision: 'conflict',
      description: 'package.json name (existing: "shop", module: "other")',
    },
  ],
};
const blocked: StepInfo = {
  slug: 'vitest',
  outcome: 'blocked',
  error: 'Module vitest requires these modules to be applied first: typescript',
  missing: ['typescript'],
};
const blockedForAnotherReason: StepInfo = {
  slug: 'fastify-server',
  outcome: 'blocked',
  error: 'Invalid property serverPort: not a port',
  missing: [],
};
const notRun: StepInfo = { slug: 'prettier', outcome: 'not-run', after: 'vitest' };

const preview = (steps: StepInfo[], canApply = false): BasketPreview => ({
  projectFolder: '/work/shop',
  steps,
  canApply,
});
const show = (value: BasketPreview, props: { applying?: boolean; label?: string } = {}) =>
  mount(PreviewResult, { props: { preview: value, ...props } });

describe('result of the preview', () => {
  it('says that the basket would apply when every module is ready', () => {
    const page = show(preview([ready], true));

    expect(page.get('[role="status"]').text()).toContain('every module would apply');
  });

  it('says that it would not, and where to look, otherwise', () => {
    const page = show(preview([ready, blocked, notRun]));

    const status = page.get('[role="status"]').text();
    expect(status).toContain('cannot apply');
    expect(status).not.toContain('every module would apply');
  });

  it('lists the modules in order, each with what it is in words', () => {
    const page = show(preview([ready, conflict, blocked, notRun]));

    const steps = page
      .findAll('.step')
      .map((step) => [step.get('.slug').text(), step.get('.outcome').text(), step.attributes('data-outcome')]);
    expect(steps).toEqual([
      ['init', 'Ready', 'ready'],
      ['typescript', 'Conflict', 'conflict'],
      ['vitest', 'Blocked', 'blocked'],
      ['prettier', 'Not run', 'not-run'],
    ]);
  });

  it('counts what a ready module would do, leaving out what it would not', () => {
    const page = show(preview([ready]));

    const summary = page.get('.report').text();
    expect(summary).toContain('2 created');
    expect(summary).toContain('1 modified');
    expect(summary).toContain('3 unchanged');
    expect(summary).not.toContain('replaced');
    expect(summary).not.toContain('skipped');
  });

  it('counts every kind of change', () => {
    const everything: StepInfo = {
      ...ready,
      report: report({ created: 1, edited: 2, replaced: 3, unchanged: 4, kept: 5, skipped: 6, conflicts: 7 }),
    };

    const summary = show(preview([everything]))
      .get('.report')
      .text();

    for (const part of [
      '1 created',
      '2 modified',
      '3 replaced',
      '4 unchanged',
      '5 kept',
      '6 skipped',
      '7 in conflict',
    ]) {
      expect(summary).toContain(part);
    }
  });

  it('says that a module changes nothing when it has nothing to do', () => {
    const idle: StepInfo = { ...ready, report: report(), changes: [] };

    expect(
      show(preview([idle]))
        .get('.report')
        .text(),
    ).toContain('Nothing to change');
  });

  it('lists the changes with the decision, in words, and what it is about', () => {
    const page = show(preview([ready]));

    const changes = page
      .findAll('.change')
      .map((change) => [change.get('.decision').text(), change.get('.what').text()]);
    expect(changes).toEqual([
      ['create', 'README.md'],
      ['modify', 'src/server/main.ts'],
      ['unchanged', '.gitignore'],
    ]);
  });

  it('names every decision', () => {
    const decisions = ['create', 'edit', 'unchanged', 'keep', 'overwrite', 'skip', 'conflict'] as const;
    const step: StepInfo = {
      ...ready,
      changes: decisions.map((decision) => ({ kind: 'file', target: decision, decision, description: decision })),
    };

    const labels = show(preview([step]))
      .findAll('.decision')
      .map((decision) => decision.text());

    expect(labels).toEqual(['create', 'modify', 'unchanged', 'keep', 'replace', 'skip', 'conflict']);
  });

  it('keeps the changes of a ready module folded, and opens those of a module in conflict', () => {
    const page = show(preview([ready, conflict]));

    const folds = page.findAll('details');
    expect(folds.map((fold) => fold.attributes('open') !== undefined)).toEqual([false, true]);
    expect(folds[0]?.get('summary').text()).toContain('Changes (3)');
  });

  it("shows the existing value against the module's for a conflict, and what to do", () => {
    const page = show(preview([conflict]));

    expect(page.get('.change').text()).toContain('existing: "shop", module: "other"');
    expect(page.get('.step').text()).toContain('Keep or replace what already exists');
  });

  it('shows the warnings of a module', () => {
    const warned: StepInfo = {
      ...ready,
      warnings: ['src/server/main.ts is replaced, and config had inserted code in it'],
    };

    expect(
      show(preview([warned]))
        .get('.warning')
        .text(),
    ).toContain('config had inserted code');
    expect(
      show(preview([ready]))
        .find('.warning')
        .exists(),
    ).toBe(false);
  });

  it('says why a module is blocked, and what it lacks', () => {
    const page = show(preview([blocked]));

    expect(page.get('.error').text()).toContain('requires these modules');
    expect(page.get('.lacks').text()).toContain('typescript');
  });

  it('says why a module is blocked when it lacks nothing', () => {
    const page = show(preview([blockedForAnotherReason]));

    expect(page.get('.error').text()).toContain('not a port');
    expect(page.find('.lacks').exists()).toBe(false);
  });

  it('says which module a module that was not run waited for', () => {
    expect(
      show(preview([notRun]))
        .get('.step')
        .text(),
    ).toContain('after vitest');
  });
  describe('the button that writes the basket', () => {
    it('is offered at the end, when every module is ready', () => {
      const page = show(preview([ready], true));

      const button = page.get('button.create');
      expect(button.text()).toBe('Create the project');
      expect(button.attributes('type')).toBe('button');
      expect(button.attributes('disabled')).toBeUndefined();
      expect(page.get('section').element.lastElementChild).toBe(button.element);
    });

    it.each([
      ['a module is in conflict', [ready, conflict]],
      ['a module is blocked', [ready, blocked, notRun]],
    ])('is shown but cannot be pressed when %s: the summary above says why', async (_case, steps) => {
      const page = show(preview(steps));

      const button = page.get('button.create');
      expect(button.text()).toBe('Create the project');
      expect(button.attributes('disabled')).toBeDefined();
      expect(button.attributes('aria-describedby')).toBe(page.get('[role="status"]').attributes('id'));
      await button.trigger('click');
      expect(page.emitted('apply')).toBeUndefined();
    });

    it('says what it does with the label it is given', () => {
      expect(
        show(preview([ready], true), { label: 'Add to the project' })
          .get('button.create')
          .text(),
      ).toBe('Add to the project');
    });

    it('asks to write the basket when it is pressed', async () => {
      const page = show(preview([ready], true));

      await page.get('button.create').trigger('click');

      expect(page.emitted('apply')).toHaveLength(1);
    });

    it('waits for the end of the writing, and cannot be pressed twice meanwhile', async () => {
      const page = show(preview([ready], true), { applying: true });

      const button = page.get('button.create');
      expect(button.text()).toBe('Creating…');
      expect(button.attributes('disabled')).toBeDefined();
      expect(button.attributes('aria-busy')).toBe('true');
      await button.trigger('click');
      expect(page.emitted('apply')).toBeUndefined();
    });
  });
});
