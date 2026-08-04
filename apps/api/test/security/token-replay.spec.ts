import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { newId } from '../../src/infrastructure/database/identifier.js';
import { bootSecurityApp, SKIP_MESSAGE, type SecurityTestApp } from './harness/app-harness.js';

/* eslint-disable sonarjs/no-hardcoded-ip -- test-only client IPs, no real network identity */
const REGISTERED_SECRET = 'S3cure!Passw0rdX';
const REFRESH_COOKIE = 'icb_refresh';

/** Supertest agent bound to the live server, for fluent cookie-aware calls. */
function agent(handle: SecurityTestApp) {
  return request(handle.app.getHttpServer());
}

/**
 * Auth endpoints are rate-limited to 5/min per client IP; each test drives its own IP (the
 * adapter trusts the proxy header, as in main.ts) so the suite never eats a 429.
 */
function fromIp(test: request.Test, ip: string): request.Test {
  return test.set('X-Forwarded-For', ip);
}

function extractRefreshCookie(setCookie: string[] | string | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie ?? '');
  const match = new RegExp(`${REFRESH_COOKIE}=[^;]+`).exec(header);
  if (!match) {
    throw new Error(`no ${REFRESH_COOKIE} cookie in: ${header.slice(0, 200)}`);
  }
  return match[0];
}

/**
 * Rotating refresh tokens with family reuse detection (agent_plan.md §11): a refresh token is
 * single-use; presenting an already-rotated one must revoke the entire session family.
 */
describe('SEC-02 token replay — refresh token rotation and family revocation', () => {
  let handle: SecurityTestApp | null = null;
  // Unique per run: a leftover credential from a crashed run must never collide with this one.
  const email = `replay-${newId().toLowerCase()}@sec02.test`;

  beforeAll(async () => {
    handle = await bootSecurityApp('replay');
    if (!handle) {
      return;
    }
    const registered = await fromIp(agent(handle).post('/v1/auth/register'), '10.2.0.1').send({
      email,
      password: REGISTERED_SECRET,
      firstName: 'Rita',
      lastName: 'Replay',
      phone: '+233200000001',
      acceptedTermsVersion: '2024-01',
    });
    expect(registered.status, JSON.stringify(registered.body).slice(0, 300)).toBe(201);
  }, 300_000);

  afterAll(async () => {
    await handle?.close();
  });

  /** Narrow the booted handle or skip-with-message — never a false failure on absent infra. */
  function requireApp(context: { skip: (note?: string) => void }): SecurityTestApp {
    if (!handle) {
      context.skip(SKIP_MESSAGE);
      throw new Error(SKIP_MESSAGE);
    }
    return handle;
  }

  function setCookieOf(response: { headers: Record<string, unknown> }): string {
    return extractRefreshCookie(response.headers['set-cookie'] as string[] | string | undefined);
  }

  it('login issues a refresh cookie and a rotated refresh works once', async (context) => {
    const h = requireApp(context);
    const ip = '10.2.1.1';
    const login = await fromIp(agent(h).post('/v1/auth/login'), ip).send({ email, password: REGISTERED_SECRET });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ outcome: 'authenticated' });
    const cookie = setCookieOf(login);

    const refreshed = await fromIp(agent(h).post('/v1/auth/refresh'), ip).set('Cookie', cookie);
    expect(refreshed.status, JSON.stringify(refreshed.body).slice(0, 300)).toBe(200);
    expect(refreshed.body).toMatchObject({ tokenType: 'Bearer' });
  });

  it('replaying a rotated refresh token revokes the whole family', async (context) => {
    const h = requireApp(context);
    const ip = '10.2.2.1';
    const sessions = h.connection.collection('sessions');
    const known = new Set((await sessions.find({}).project({ _id: 1 }).toArray()).map((row) => String(row['_id'])));

    const login = await fromIp(agent(h).post('/v1/auth/login'), ip).send({ email, password: REGISTERED_SECRET });
    const first = setCookieOf(login);

    // Legitimate rotation: first -> second. `first` is now a spent token.
    const rotated = await fromIp(agent(h).post('/v1/auth/refresh'), ip).set('Cookie', first);
    expect(rotated.status).toBe(200);
    const second = setCookieOf(rotated);

    // The replay: presenting the spent token must be detected and must kill the family.
    const replayed = await fromIp(agent(h).post('/v1/auth/refresh'), ip).set('Cookie', first);
    expect(replayed.status).toBe(401);
    expect(replayed.body).toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });

    // Family revocation: the legitimately-rotated successor is dead too.
    const successor = await fromIp(agent(h).post('/v1/auth/refresh'), ip).set('Cookie', second);
    expect(successor.status).toBe(401);

    // In the database: every session created by this flow is revoked; the successor carries the
    // reuse reason while the replayed row keeps its original 'rotated' marker.
    const mine = (await sessions.find({}).toArray()).filter((row) => !known.has(String(row['_id'])));
    expect(mine).toHaveLength(2);
    for (const row of mine) {
      expect(row['revokedAt'], `session ${String(row['_id'])} should be revoked`).not.toBeNull();
    }
    expect(mine.some((row) => row['revokedReason'] === 'refresh_token_reuse')).toBe(true);
  });

  it('a fabricated refresh token is rejected without touching other sessions', async (context) => {
    const h = requireApp(context);
    const ip = '10.2.3.1';
    const forged = await fromIp(agent(h).post('/v1/auth/refresh'), ip)
      .set('Cookie', `${REFRESH_COOKIE}=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`);
    expect(forged.status).toBe(401);

    const missing = await fromIp(agent(h).post('/v1/auth/refresh'), ip);
    expect(missing.status).toBe(401);
  });
});
