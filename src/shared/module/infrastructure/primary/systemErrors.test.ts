import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { describe, expect, it } from 'vitest';
import { tmpDirForTest } from '../../../test/ModuleAssertions.js';
import { describeSystemError, isSystemError } from './systemErrors.js';

const failure = (action: () => void): unknown => {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('the action was expected to fail');
};

describe('system errors', () => {
  describe('isSystemError', () => {
    it('recognizes the errors the file system really raises', () => {
      const folder = tmpDirForTest();
      writeFileSync(join(folder, 'file'), '');
      mkdirSync(join(folder, 'dir'));

      const notADirectory = failure(() => mkdirSync(join(folder, 'file', 'child')));
      const isADirectory = failure(() => readFileSync(join(folder, 'dir')));

      expect(isSystemError(notADirectory)).toBe(true);
      expect(isSystemError(isADirectory)).toBe(true);
    });

    it('does not catch a plain error', () => {
      expect(isSystemError(new Error('boom'))).toBe(false);
      expect(isSystemError(new TypeError('boom'))).toBe(false);
    });

    it('does not catch an error whose code is not a string', () => {
      expect(isSystemError(Object.assign(new Error('boom'), { code: 13, syscall: 'open' }))).toBe(false);
    });

    it('does not catch an error with a code but no failed system call', () => {
      expect(isSystemError(Object.assign(new Error('boom'), { code: 'EACCES' }))).toBe(false);
    });

    it('does not catch the other errors of Node, which also carry a code', () => {
      const usage = failure(() => parseArgs({ args: ['--nope'], options: {} }));

      expect(isSystemError(usage)).toBe(false);
      expect(isSystemError(Object.assign(new Error('x'), { code: 'ERR_INVALID_ARG_TYPE', syscall: 'open' }))).toBe(
        false,
      );
    });

    it('does not catch something that is not an error', () => {
      expect(isSystemError({ code: 'EACCES', syscall: 'open' })).toBe(false);
      expect(isSystemError('EACCES')).toBe(false);
      expect(isSystemError(undefined)).toBe(false);
    });
  });

  describe('describeSystemError', () => {
    const error = (code: string, syscall: string, path?: string) =>
      Object.assign(new Error(`${code}: ...`), { code, syscall, ...(path === undefined ? {} : { path }) });

    it.each([
      ['EACCES', 'mkdir', 'cannot write /p/src: permission denied (EACCES)'],
      ['ENOTDIR', 'rename', 'cannot write /p/src: not a directory (ENOTDIR)'],
      ['ENOSPC', 'write', 'cannot write /p/src: no space left on device (ENOSPC)'],
      ['EISDIR', 'open', 'cannot access /p/src: is a directory (EISDIR)'],
      ['EWEIRD', 'open', 'cannot access /p/src: system error (EWEIRD)'],
    ])('describes %s during %s on one line', (code, syscall, expected) => {
      expect(describeSystemError(error(code, syscall, '/p/src'))).toBe(expected);
    });

    it('still works without a path', () => {
      expect(describeSystemError(error('EACCES', 'open'))).toBe('cannot access: permission denied (EACCES)');
    });
  });
});
