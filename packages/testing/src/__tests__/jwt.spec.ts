import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { mintTestAccessJwt } from '../auth/jwt.js';
import { TestClock } from '../core/clock.js';
import { JWT_AUDIENCE, JWT_ISSUER, TEST_USER_ID } from '../testing.constants.js';

const SIGNING_KEY = 'test-signing-key-0000000000000001';

describe('mintTestAccessJwt', () => {
  it('signs a token the API guard would accept', () => {
    const token = mintTestAccessJwt({ secret: SIGNING_KEY });
    // eslint-disable-next-line sonarjs/hardcoded-secret-signatures -- test-only HMAC key, not a credential
    const decoded = jwt.verify(token, SIGNING_KEY, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    expect(decoded).toMatchObject({ sub: TEST_USER_ID, typ: 'access' });
  });

  it('carries overridden claims', () => {
    const token = mintTestAccessJwt({
      secret: SIGNING_KEY,
      claims: { sub: '01JTEST0000000000000000099', roles: ['admin'], customerId: null },
    });
    const decoded = jwt.decode(token);
    expect(decoded).toMatchObject({
      sub: '01JTEST0000000000000000099',
      roles: ['admin'],
      customerId: null,
    });
  });

  it('rejects verification with the wrong secret', () => {
    const token = mintTestAccessJwt({ secret: SIGNING_KEY });
    // eslint-disable-next-line sonarjs/hardcoded-secret-signatures -- deliberately wrong test key
    expect(() => jwt.verify(token, 'not-the-right-key')).toThrow();
  });

  it('uses the injected clock for iat, keeping tokens deterministic', () => {
    const clock = TestClock.fixed();
    const first = mintTestAccessJwt({ secret: SIGNING_KEY, clock });
    const second = mintTestAccessJwt({ secret: SIGNING_KEY, clock });
    expect(first).toBe(second);
    const decoded = jwt.decode(first);
    expect(decoded).toMatchObject({ iat: clock.epochSeconds() });
  });
});
