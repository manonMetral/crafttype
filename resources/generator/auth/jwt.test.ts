import { describe, expect, it } from 'vitest';
import { createJwtService } from './jwt.js';

describe('createJwtService', () => {
  it('signs and verifies a token', () => {
    const jwt = createJwtService('secret', 3600, () => 10_000);

    const token = jwt.sign({ sub: 'alice', role: 'admin' });
    expect(jwt.verify(token)).toEqual({
      sub: 'alice',
      role: 'admin',
      iat: 10,
      exp: 3610,
    });
  });

  it('rejects an expired token', () => {
    let now = 10_000;
    const jwt = createJwtService('secret', 1, () => now);
    const token = jwt.sign({ sub: 'alice' });

    now = 12_000;
    expect(() => jwt.verify(token)).toThrow('Token expired');
  });

  it('rejects a token with an invalid signature', () => {
    const jwt = createJwtService('secret');
    const token = jwt.sign({ sub: 'alice' });

    expect(() => jwt.verify(`${token}x`)).toThrow('Invalid token signature');
  });
});
