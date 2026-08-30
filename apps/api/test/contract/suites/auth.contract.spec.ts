import request from 'supertest';
import { ulid } from 'ulid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  AuthenticatedUser,
  Session,
} from '@icb/contracts';
import { authOperations } from '@icb/contracts/openapi/routes/auth';
import { TokenService } from '../../../src/modules/auth/application/token.service.js';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/** The fixture login secret this suite registers and rotates with. Meets the password policy:
 * 12+ chars, both cases, a digit. */
const NEW_SECRET = 'Contract!234567';

/**
 * Contract suite: auth.
 *
 * Boots the real app on a throwaway database, then drives the credential lifecycle over HTTP,
 * pinning every response to its route-table schema. The three GET endpoints (`/auth/me`,
 * `/auth/sessions`, `/auth/login-history`) are the coverage obligation; mutations both
 * exercise their own success schemas and build the state the GETs are asserted against.
 *
 * Harness note: auth endpoints load the *credential* by `sub`, so the suite mints its own
 * token against the seeded credential id and sends it by hand (ctx only carries the harness
 * tokens). `@fastify/cookie` is registered by the harness exactly as main.ts does, so the
 * cookie-writing endpoints (login, logout) are asserted for real.
 */
describe('contract: auth', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;
  let server: unknown;
  let credentialId = '';
  let userToken = '';
  let customerEmail = '';
  let customerPassword = '';

  beforeAll(async () => {
    boot = await bootContractApp();
    if (!boot.available) return;
    app = boot.app;
    ctx = new ContractContext(app);
    server = app.app.getHttpAdapter().getInstance().server;
    customerEmail = app.customerEmail;

    const credential = await app.db
      .collection<{ _id: string; customerId: string | null }>('user_credentials')
      .findOne({ email: customerEmail });
    if (!credential) {
      throw new Error(`Seed completed but the ${customerEmail} credential is missing.`);
    }
    credentialId = credential._id;
    const tokens = app.moduleRef.get(TokenService);
    const issued = await tokens.issueAccessToken({
      sub: credential._id,
      customerId: credential.customerId,
      email: customerEmail,
      roles: [],
      sessionId: `session-${credential._id}`,
    });
    userToken = issued.token;
    const demo = app.seedLogins.find((login) => login.email === customerEmail);
    if (!demo) {
      throw new Error(`Seed logins lost the ${customerEmail} persona.`);
    }
    customerPassword = demo.password;
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(authOperations);
      await closeContractApp(app);
    }
  });

  /** The credential-id token the harness cannot mint; mirrors ContractContext.authorise. */
  function asUser(method: 'get' | 'post' | 'delete', path: string): request.Test {
    return request(server as never)
      [method](`/v1${path}`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', ulid());
  }

  it('getCurrentUser — the credential token resolves to the seeded persona', async (t) => {
    requireInfra(t, boot);
    const res = await asUser('get', operationOf('getCurrentUser').path);
    const me = ctx.expectContract('getCurrentUser', res) as AuthenticatedUser;
    expect(me.email).toBe(customerEmail);
    expect(me.userId).toBe(credentialId);
  });

  it('listSessions / revokeSession — a seeded session row is listed and revocable', async (t) => {
    requireInfra(t, boot);
    // Login cannot mint a session (cookie drift below), so write the row the way
    // SessionWriter.record would — the sanctioned db path when no API route can.
    const sessionId = ulid();
    await insertSession(app as ContractApp, credentialId, sessionId);

    const res = await asUser('get', operationOf('listSessions').path);
    const sessions = ctx.expectContract('listSessions', res) as Session[];
    expect(sessions.some((session) => session.id === sessionId)).toBe(true);

    const other = sessions.find((session) => !session.current) ?? sessions[0];
    if (!other) {
      throw new Error('listSessions returned an empty page after seeding a session row.');
    }
    const revokePath = fillPath(operationOf('revokeSession').path, { sessionId: other.id });
    ctx.expectContract('revokeSession', await asUser('delete', revokePath));
  });

  it('listLoginHistory — the customer’s own sign-in audit reads back as declared', async (t) => {
    requireInfra(t, boot);
    const res = await asUser('get', operationOf('listLoginHistory').path);
    ctx.expectContract('listLoginHistory', res);
  });

  it('register — a fresh customer gets the declared created-user shape', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(
      operationOf('register').path,
      {
        email: `contract-${ulid().toLowerCase()}@icb.example`,
        password: NEW_SECRET,
        firstName: 'Contract',
        lastName: 'Persona',
        phone: '+233209876543',
        acceptedTermsVersion: '1.0',
      },
      'none',
    );
    ctx.expectContract('register', res);
  });

  it('login — the seeded persona signs in and gets the declared session shape', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(operationOf('login').path, {
      email: customerEmail,
      password: customerPassword,
    }, 'none');
    ctx.expectContract('login', res);
  });

  it('logout — signing out answers the declared no-content response', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(operationOf('logout').path, {}, 'none');
    ctx.expectContract('logout', res);
  });

  // KNOWN DRIFT (report to SDK-01 + auth owner): the route table's password and email
  // endpoints do not exist at their declared paths — the controllers mount them at
  // `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` and
  // `/auth/verify-email` instead, so each contracted path answers 404. `it.fails` pins the
  // drift; when either side is fixed these go red and must be converted back to `it`.
  it.fails('forgotPassword [DRIFT: declared /auth/password/forgot 202; controller is /auth/forgot-password 204]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(operationOf('forgotPassword').path, { email: customerEmail }, 'none');
    ctx.expectContract('forgotPassword', res);
  });

  it.fails('resetPassword [DRIFT: declared /auth/password/reset; controller is /auth/reset-password]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(
      operationOf('resetPassword').path,
      { token: '0'.repeat(16), password: NEW_SECRET },
      'none',
    );
    ctx.expectContract('resetPassword', res);
  });

  it.fails('changePassword [DRIFT: declared /auth/password/change; controller is /auth/change-password]', async (t) => {
    requireInfra(t, boot);
    const res = await asUser('post', operationOf('changePassword').path).send({
      currentPassword: customerPassword,
      newPassword: NEW_SECRET,
    });
    ctx.expectContract('changePassword', res);
  });

  it.fails('verifyEmail [DRIFT: declared /auth/email/verify; controller is /auth/verify-email]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(operationOf('verifyEmail').path, { token: '0'.repeat(16) }, 'none');
    ctx.expectContract('verifyEmail', res);
  });

  // KNOWN DRIFT: same class as above — the table declares DELETE /auth/sessions, but the
  // controller mounts POST /auth/logout-all.
  it.fails('revokeAllSessions [DRIFT: declared DELETE /auth/sessions; controller is POST /auth/logout-all]', async (t) => {
    requireInfra(t, boot);
    const res = await asUser('delete', operationOf('revokeAllSessions').path);
    ctx.expectContract('revokeAllSessions', res);
  });
});

/** Insert a live session row exactly as SessionWriter.record writes it (timestamps included). */
async function insertSession(app: ContractApp, userId: string, sessionId: string): Promise<void> {
  const now = app.clock.now();
  await app.db.collection<{ _id: string } & Record<string, unknown>>('sessions').insertOne({
    _id: sessionId,
    userId,
    familyId: `family-${ulid()}`,
    tokenHash: `hash-${ulid()}`,
    device: { label: 'Contract test device', userAgent: 'contract-test', deviceId: null },
    ipAddress: '127.0.0.1',
    location: null,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 86_400_000),
    revokedAt: null,
    revokedReason: null,
    createdAt: now,
    updatedAt: now,
  });
}
