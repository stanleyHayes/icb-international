import type { AuthTokens, AuthenticatedUser } from '@icb/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';

import {
  bootIntegrationApp,
  describeIntegration,
  probeMongo,
  type IntegrationApp,
} from './harness/integration-suite.js';
import {
  anonymous,
  CUSTOMER_PASSWORD,
  login,
  refreshSession,
  registerCustomer,
  TERMS_VERSION,
} from './harness/flows.js';

/**
 * Auth money-path: register → login → refresh → logout, full request → DB → response.
 * Registration starts no session; the first tokens come from login, and refresh rotation must
 * make the old cookie worthless (token replay).
 *
 * One shared customer: auth routes are throttled to 5 requests/minute per IP
 * (AUTH_THROTTLE_LIMIT), so a file that registers a fresh user per test rate-limits itself.
 */
const suite = await probeMongo('auth01');

describeIntegration(suite, 'auth (integration)', () => {
  let context: IntegrationApp;
  let registered: AuthenticatedUser;
  let email: string;

  beforeAll(async () => {
    // probeMongo only succeeded when the suite is available; the harness is non-null here.
    context = await bootIntegrationApp(suite.harness!);
    const customer = await registerCustomer(context.app, 'auth-shared');
    registered = customer.user;
    email = customer.email;
  });

  afterAll(async () => {
    await context?.close();
  });

  it('registers a customer without starting a session', () => {
    expect(registered.email).toBe('qa03.auth-shared@example.test');
    expect(registered.customerId).not.toBeNull();
    // Registration must not double as login: no tokens, no cookie in the contract.
    expect(registered).not.toHaveProperty('tokens');
  });

  it('rejects a duplicate registration with the same email', async () => {
    const response = await anonymous(context.app)
      .post('/v1/auth/register')
      .send({
        email,
        password: CUSTOMER_PASSWORD,
        firstName: 'QA',
        lastName: 'Integration',
        phone: '+233201234567',
        acceptedTermsVersion: TERMS_VERSION,
      });
    expect(response.status).toBe(409);
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const session = await login(context.app, email);
    expect(session.accessToken.length).toBeGreaterThan(0);

    const me = await session.agent.get('/v1/auth/me').expect(200);
    expect((me.body as { email: string }).email).toBe(email);

    // Derived from the fixture so it cannot drift into being the right password by accident.
    const wrong = await anonymous(context.app)
      .post('/v1/auth/login')
      .send({ email, password: `not-${CUSTOMER_PASSWORD}` });
    expect(wrong.status).toBe(401);
  });

  it('rotates the refresh cookie and rejects a replayed one', async () => {
    const session = await login(context.app, email);

    const rotated = await refreshSession(context.app, session.refreshCookie);
    expect(rotated.status).toBe(200);
    const tokens = rotated.body as AuthTokens;
    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.accessToken.length).toBeGreaterThan(0);

    // Replaying the consumed cookie is token theft as far as the API is concerned.
    const replay = await refreshSession(context.app, session.refreshCookie);
    expect(replay.status).toBe(401);
  });

  it('invalidates the session on logout', async () => {
    const session = await login(context.app, email);

    await anonymous(context.app)
      .post('/v1/auth/logout')
      .set('Cookie', session.refreshCookie)
      .expect(204);

    const after = await refreshSession(context.app, session.refreshCookie);
    expect(after.status).toBe(401);
  });
});
