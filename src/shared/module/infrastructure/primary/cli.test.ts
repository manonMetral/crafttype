import { describe, expect, it } from 'vitest';
import type { PropertyDefinition } from '../../domain/ModuleProperties.js';
import { summary } from './cli.js';

describe('summary of an option', () => {
  const option = (rest: Partial<PropertyDefinition>): PropertyDefinition => ({
    key: 'poolSize',
    type: 'string',
    mandatory: false,
    description: 'Pool size',
    ...rest,
  });

  it.each([
    ['a required option', { mandatory: true }, '(required) Pool size'],
    ['a number by default', { defaultValue: 10 }, '(default: 10) Pool size'],
    ['false by default', { defaultValue: false }, '(default: false) Pool size'],
    ['a default computed from the folder', { defaultValue: () => 'app' }, 'Pool size'],
    ['no default at all', {}, 'Pool size'],
  ])('describes %s', (_case, rest, expected) => {
    expect(summary(option(rest))).toBe(expected);
  });

  it('does not let the source of a computed default leak into the help', () => {
    expect(summary(option({ defaultValue: ({ projectFolder }) => projectFolder }))).not.toMatch(/=>|function/);
  });
});
