import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  const defaults = { port: 3000, host: '127.0.0.1' };

  it('garde les valeurs par défaut sans variable d’environnement', () => {
    expect(loadConfig(defaults, {})).toEqual(defaults);
  });

  it('lit PORT et HOST', () => {
    expect(loadConfig(defaults, { PORT: '8080', HOST: '0.0.0.0' })).toEqual({
      port: 8080,
      host: '0.0.0.0',
    });
  });

  it('ignore les valeurs vides', () => {
    expect(loadConfig(defaults, { PORT: ' ', HOST: '' })).toEqual(defaults);
  });

  it.each(['abc', '0', '-1', '3.5', '65536'])('refuse PORT=%s', (port) => {
    expect(() => loadConfig(defaults, { PORT: port })).toThrow('PORT invalide');
  });
});
