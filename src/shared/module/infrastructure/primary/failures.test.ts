import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MissingPropertyError, UnknownModuleError } from '../../domain/errors.js';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { classify } from './failures.js';

describe('classification of failures', () => {
  it.each([new UnknownModuleError('nope'), new MissingPropertyError('projectFolder')])(
    'recognizes an error of the tool: %s',
    (error) => {
      expect(classify(error)).toEqual({ kind: 'domain', error });
    },
  );

  it('recognizes a failure of the file system, and describes it', () => {
    let error: unknown;
    try {
      readFileSync(tmpDirForTest());
    } catch (caught) {
      error = caught;
    }

    expect(classify(error)).toEqual({ kind: 'system', message: 'cannot access: is a directory (EISDIR)' });
  });

  it.each([
    ['a bug', new TypeError('bug')],
    ['a plain error', new Error('boom')],
    ['an error with a code but no failed system call', Object.assign(new Error('x'), { code: 'EACCES' })],
    ['a text', 'just a string'],
    ['nothing', undefined],
  ])('leaves %s as unexpected, the very same value', (_case, error) => {
    const failure = classify(error);

    expect(failure.kind).toBe('unexpected');
    expect(failure).toHaveProperty('error', error);
  });
});
