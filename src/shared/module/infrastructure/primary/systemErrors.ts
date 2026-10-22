/**
 * A failure of the operating system while reading or writing the project (permission denied, not a folder, disk full...).
 * `NodeJS.ErrnoException` is only a TypeScript interface, there is no such class at runtime: such an error is
 * recognized by its shape. Node sets a POSIX `code` (`EACCES`) and the failed `syscall` on every one of them, whereas
 * other errors that carry a `code` (`ERR_PARSE_ARGS_*`, `ERR_INVALID_ARG_TYPE`) have no `syscall`.
 */
export type SystemError = Error & { code: string; syscall: string; path?: string };

export const isSystemError = (error: unknown): error is SystemError =>
  error instanceof Error &&
  'code' in error &&
  typeof error.code === 'string' &&
  /^E[A-Z0-9]+$/.test(error.code) &&
  'syscall' in error &&
  typeof error.syscall === 'string';

const REASONS: Readonly<Record<string, string>> = {
  EACCES: 'permission denied',
  EPERM: 'operation not permitted',
  ENOENT: 'no such file or directory',
  ENOTDIR: 'not a directory',
  EISDIR: 'is a directory',
  ENOSPC: 'no space left on device',
  EROFS: 'read-only file system',
  EEXIST: 'file already exists',
  EMFILE: 'too many open files',
};

const WRITING_SYSCALLS = new Set(['mkdir', 'rename', 'unlink', 'write', 'copyfile', 'chmod']);

/** One line, for example `cannot write /app/src/a.ts: permission denied (EACCES)`. */
export const describeSystemError = ({ code, syscall, path }: SystemError): string => {
  const action = WRITING_SYSCALLS.has(syscall) ? 'write' : 'access';
  const where = path === undefined ? '' : ` ${path}`;
  return `cannot ${action}${where}: ${REASONS[code] ?? 'system error'} (${code})`;
};
