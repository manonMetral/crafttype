import { describe, expect, it } from 'vitest';
import { authSecretFromEnv } from './authentication.js';

const STRONG_SECRET = 'a-secret-of-at-least-32-characters!!';

describe('authSecretFromEnv', () => {
  it('uses the configured secret', () => {
    expect(authSecretFromEnv({ AUTH_JWT_SECRET: STRONG_SECRET })).toBe(
      STRONG_SECRET,
    );
  });

  it('trims the configured secret', () => {
    expect(authSecretFromEnv({ AUTH_JWT_SECRET: `  ${STRONG_SECRET}  ` })).toBe(
      STRONG_SECRET,
    );
  });

  it('rejects a configured secret shorter than 32 characters', () => {
    expect(() => authSecretFromEnv({ AUTH_JWT_SECRET: 'too-short' })).toThrow(
      'Invalid AUTH_JWT_SECRET: expected at least 32 characters',
    );
  });

  it('rejects a short secret in production too', () => {
    expect(() =>
      authSecretFromEnv({ NODE_ENV: 'production', AUTH_JWT_SECRET: 'short' }),
    ).toThrow('Invalid AUTH_JWT_SECRET: expected at least 32 characters');
  });

  it('requires a secret in production', () => {
    expect(() => authSecretFromEnv({ NODE_ENV: 'production' })).toThrow(
      'Missing AUTH_JWT_SECRET: required when NODE_ENV=production',
    );
    expect(() =>
      authSecretFromEnv({ NODE_ENV: 'production', AUTH_JWT_SECRET: '   ' }),
    ).toThrow('Missing AUTH_JWT_SECRET: required when NODE_ENV=production');
  });

  it('draws a random secret outside production when none is configured', () => {
    const first = authSecretFromEnv({});
    const second = authSecretFromEnv({ NODE_ENV: 'development' });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('dev-secret-change-me');
  });
});
