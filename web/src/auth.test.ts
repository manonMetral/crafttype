import { describe, expect, it } from 'vitest';
import { readToken } from './auth';

describe('token of the address', () => {
  const setup = (storageContent: Record<string, string> = {}) => {
    const stored = new Map(Object.entries(storageContent));
    const replaced: string[] = [];
    return {
      stored,
      replaced,
      storage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
      },
      history: {
        replaceState: (_state: unknown, _title: string, url?: string | URL | null) => void replaced.push(String(url)),
      },
    };
  };
  const at = (search: string, pathname = '/', hash = '') => ({ search, pathname, hash });

  it('reads the token the address carries, and keeps it for the tab', () => {
    const { storage, history, stored } = setup();

    expect(readToken(at('?token=abc-123_XYZ'), storage, history)).toBe('abc-123_XYZ');
    expect(stored.get('crafttype.token')).toBe('abc-123_XYZ');
  });

  it('takes the token out of the address at once', () => {
    const { storage, history, replaced } = setup();

    readToken(at('?token=abc'), storage, history);

    expect(replaced).toEqual(['/']);
  });

  it('keeps the rest of the address', () => {
    const { storage, history, replaced } = setup();

    readToken(at('?a=1&token=abc&b=2', '/page', '#section'), storage, history);

    expect(replaced).toEqual(['/page?a=1&b=2#section']);
  });

  it('prefers the token of the address to the one the tab kept', () => {
    const { storage, history, stored } = setup({ 'crafttype.token': 'old' });

    expect(readToken(at('?token=new'), storage, history)).toBe('new');
    expect(stored.get('crafttype.token')).toBe('new');
  });

  it('uses the token the tab kept once the address no longer has it (a reload)', () => {
    const { storage, history, replaced } = setup({ 'crafttype.token': 'kept' });

    expect(readToken(at(''), storage, history)).toBe('kept');
    expect(replaced).toEqual([]);
  });

  it('has no token when there is none anywhere', () => {
    const { storage, history, stored } = setup();

    expect(readToken(at('?other=1'), storage, history)).toBeUndefined();
    expect(stored.size).toBe(0);
  });

  it('does not take an empty token for one, but still cleans the address', () => {
    const { storage, history, replaced, stored } = setup({ 'crafttype.token': 'kept' });

    expect(readToken(at('?token='), storage, history)).toBe('kept');
    expect(replaced).toEqual(['/']);
    expect(stored.get('crafttype.token')).toBe('kept');
  });

  it('has no token when the empty one is all there is', () => {
    const { storage, history } = setup();

    expect(readToken(at('?token='), storage, history)).toBeUndefined();
  });
});
