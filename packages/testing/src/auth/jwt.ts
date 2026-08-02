import jwt from 'jsonwebtoken';

import type { TestClock } from '../core/clock.js';
import {
  JWT_ACCESS_TTL_SECONDS,
  JWT_ACCESS_TYPE,
  JWT_AUDIENCE,
  JWT_ISSUER,
  TEST_CUSTOMER_ID,
  TEST_SESSION_ID,
  TEST_USER_EMAIL,
  TEST_USER_ID,
} from '../testing.constants.js';

/**
 * Access-token claims, mirroring `AccessTokenClaims` in
 * `apps/api/src/modules/auth/application/token.service.ts`. The API verifies issuer, audience,
 * and HS256 signature — a token missing any of these is rejected, so all three are set here.
 */
export interface TestAccessClaims {
  readonly sub: string;
  readonly customerId: string | null;
  readonly email: string;
  readonly roles: readonly string[];
  readonly sessionId: string;
}

export interface MintJwtOptions {
  /** HS256 secret — must match the API's `JWT_ACCESS_SECRET` in the suite under test. */
  readonly secret: string;
  readonly claims?: Partial<TestAccessClaims>;
  readonly expiresInSeconds?: number;
  /**
   * When supplied, `iat` is taken from the clock instead of the host time, keeping token
   * contents deterministic (and verifiable against a time-travelled API clock).
   */
  readonly clock?: TestClock;
}

/**
 * Mint a signed access JWT the API's auth guard will accept.
 *
 * When `clock` is supplied, `iat` is written into the payload — jsonwebtoken anchors both `iat`
 * and the derived `exp` to it, so the whole token is deterministic and time-travel-safe.
 */
export function mintTestAccessJwt(options: MintJwtOptions): string {
  const claims: TestAccessClaims = { ...defaultClaims(), ...options.claims };
  const payload: Record<string, unknown> = { ...claims, typ: JWT_ACCESS_TYPE };
  if (options.clock) {
    payload['iat'] = options.clock.epochSeconds();
  }
  const signOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: options.expiresInSeconds ?? JWT_ACCESS_TTL_SECONDS,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
  return jwt.sign(payload, options.secret, signOptions);
}

export function defaultClaims(overrides: Partial<TestAccessClaims> = {}): TestAccessClaims {
  return {
    sub: TEST_USER_ID,
    customerId: TEST_CUSTOMER_ID,
    email: TEST_USER_EMAIL,
    roles: [],
    sessionId: TEST_SESSION_ID,
    ...overrides,
  };
}
