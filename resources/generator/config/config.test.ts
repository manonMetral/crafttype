import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const defaults = { port: 3000, host: '127.0.0.1' };

  it('keeps the default values without environment variables', () => {
    expect(loadConfig(defaults, {})).toEqual(defaults);
  });

  it('reads PORT and HOST', () => {
    expect(loadConfig(defaults, { PORT: '8080', HOST: '0.0.0.0' })).toEqual({
      port: 8080,
      host: '0.0.0.0',
    });
  });

  it('ignores blank values', () => {
    expect(loadConfig(defaults, { PORT: ' ', HOST: '' })).toEqual(defaults);
  });

  it.each(['abc', '0', '-1', '3.5', '65536'])('rejects PORT=%s', (port) => {
    expect(() => loadConfig(defaults, { PORT: port })).toThrow('Invalid PORT');
  });
});
