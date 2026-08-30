/**
 * Shared helpers for the QA-08 load smoke (agent_plan.md §10, perf row).
 *
 * Both scripts authenticate once in `setup()` against the seeded demo customer
 * (`demo@icb.example`, `pnpm seed`) and reuse the access token for every VU.
 * The token TTL is 900 s (JWT_ACCESS_TTL_SECONDS), so keep smoke durations
 * well under that.
 */
import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4100';
export const DEMO_EMAIL = __ENV.DEMO_EMAIL || 'demo@icb.example';
export const DEMO_PASSWORD = __ENV.DEMO_PASSWORD || 'Demo!2345678';

/**
 * Logs in once and resolves the demo customer's primary current account plus
 * one destination account (savings) for quote requests. Fails fast with a
 * readable message when the API or the seed data is missing — a load smoke
 * that reports 401s as latency numbers is worse than no run at all.
 */
export function loginAndResolveAccounts() {
  const login = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    { headers: { 'content-type': 'application/json' }, tags: { endpoint: 'setup_login' } },
  );
  if (login.status !== 200) {
    fail(
      `login failed (HTTP ${login.status}) — is the API running at ${BASE_URL} ` +
        'and seeded (`pnpm seed`)?',
    );
  }
  const body = login.json();
  const token = body.tokens.accessToken;

  const accounts = http.get(`${BASE_URL}/v1/accounts`, {
    headers: authHeaders(token),
    tags: { endpoint: 'setup_accounts' },
  });
  if (accounts.status !== 200) {
    fail(`GET /v1/accounts failed during setup (HTTP ${accounts.status})`);
  }
  const items = accounts.json('items');
  if (!items || items.length < 2) {
    fail(`demo customer needs at least 2 accounts for transfer quotes, found ${items ? items.length : 0}`);
  }
  const from = items.find((a) => a.kind === 'current') || items[0];
  const to = items.find((a) => a.id !== from.id);

  return { token, fromAccountId: from.id, toAccountId: to.id };
}

export function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

/**
 * One key per request: the smoke measures the real write path, not the
 * idempotent replay path. Collision-safe without a UUID dependency.
 */
export function uniqueIdempotencyKey() {
  return `k6-${__VU}-${__ITER}-${Date.now()}`;
}

export function checkOk(res, expectedStatus, endpoint) {
  check(res, {
    [`${endpoint} status ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });
}
