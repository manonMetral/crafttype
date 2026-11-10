import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppliedResult from './AppliedResult.vue';
import type { AppliedStepInfo, ApplyResult, ReportInfo } from './types';

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

const init: AppliedStepInfo = {
  slug: 'init',
  report: report({ created: 3, edited: 1 }),
  warnings: [],
  changes: [
    { kind: 'file', target: 'README.md', decision: 'create', description: 'README.md' },
    { kind: 'edit', target: 'src/server/main.ts', decision: 'edit', description: 'src/server/main.ts' },
  ],
};
const typescript: AppliedStepInfo = {
  slug: 'typescript',
  report: report({ unchanged: 2 }),
  warnings: [],
  changes: [{ kind: 'file', target: 'tsconfig.json', decision: 'unchanged', description: 'tsconfig.json' }],
};

const applied = (steps: AppliedStepInfo[]): Extract<ApplyResult, { outcome: 'applied' }> => ({
  outcome: 'applied',
  projectFolder: '/work/shop',
  steps,
});
const show = (steps: AppliedStepInfo[]) => mount(AppliedResult, { props: { result: applied(steps) } });

describe('result of the application', () => {
  it('says that the modules were written, and where', () => {
    const status = show([init, typescript]).get('[role="status"]').text();

    expect(status).toContain('2 modules applied');
    expect(status).toContain('/work/shop');
  });

  it('says it in the singular for one module', () => {
    expect(show([init]).get('[role="status"]').text()).toContain('1 module applied');
  });

  it('lists the modules in the order they were applied', () => {
    expect(
      show([init, typescript])
        .findAll('.slug')
        .map((slug) => slug.text()),
    ).toEqual(['init', 'typescript']);
  });

  it('counts what each module did, in the words of the preview', () => {
    const page = show([init, typescript]);

    const sentences = page.findAll('.report').map((sentence) => sentence.text());
    expect(sentences).toEqual(['3 created, 1 modified.', '2 unchanged.']);
  });

  it('says that a module changed nothing when it had nothing to do', () => {
    const idle: AppliedStepInfo = { ...typescript, report: report(), changes: [] };

    expect(show([idle]).get('.report').text()).toContain('Nothing to change');
  });

  it('lists the changes of each module, folded', () => {
    const page = show([init]);

    const changes = page
      .findAll('.change')
      .map((change) => [change.get('.decision').text(), change.get('.what').text()]);
    expect(changes).toEqual([
      ['create', 'README.md'],
      ['modify', 'src/server/main.ts'],
    ]);
    expect(page.get('details').attributes('open')).toBeUndefined();
    expect(page.get('summary').text()).toContain('Changes (2)');
  });

  it('has no list of changes for a module that has none', () => {
    expect(
      show([{ ...typescript, changes: [] }])
        .find('details')
        .exists(),
    ).toBe(false);
  });

  it('shows the warnings of a module', () => {
    const warned: AppliedStepInfo = {
      ...init,
      warnings: ['src/server/main.ts is replaced, and config had inserted code in it'],
    };

    expect(show([warned]).get('.warning').text()).toContain('config had inserted code');
    expect(show([init]).find('.warning').exists()).toBe(false);
  });
});
