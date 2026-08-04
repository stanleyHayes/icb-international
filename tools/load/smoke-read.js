/**
 * QA-08 read smoke — agent_plan.md §10 perf gate: p95 < 200 ms at 500 rps.
 *
 * Hits the two hot read paths of the customer app: the account list
 * (`GET /v1/accounts`) and the paginated transaction ledger
 * (`GET /v1/transactions?limit=20`), alternating 50/50.
 *
 * Run: k6 run tools/load/smoke-read.js   (or ./tools/load/run-smoke.sh read)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

import {
  authHeaders,
  BASE_URL,
  checkOk,
  loginAndResolveAccounts,
} from './lib/common.js';

const READ_RPS = Number(__ENV.READ_RPS || 500);
const DURATION = __ENV.DURATION || '60s';

export const options = {
  scenarios: {
    reads: {
      executor: 'constant-arrival-rate',
      rate: READ_RPS,
      timeUnit: '1s',
      duration: DURATION,
      // 500 rps at the p95 budget of 200 ms needs ~100 VUs in flight; headroom
      // for slower responses without dropping iterations.
      preAllocatedVUs: 50,
      maxVUs: 400,
    },
  },
  thresholds: {
    // The gate itself: tagged per endpoint so one slow path can't hide behind
    // the other, plus a hard error ceiling.
    'http_req_duration{endpoint:accounts}': ['p(95)<200'],
    'http_req_duration{endpoint:transactions}': ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  return loginAndResolveAccounts();
}

export default function (data) {
  const headers = { headers: authHeaders(data.token) };
  // Alternate between the two read paths so each sustains ~READ_RPS/2.
  if (__ITER % 2 === 0) {
    const res = http.get(`${BASE_URL}/v1/accounts`, {
      ...headers,
      tags: { endpoint: 'accounts' },
    });
    checkOk(res, 200, 'accounts');
    check(res, { 'accounts payload non-empty': (r) => r.json('items.#') > 0 });
  } else {
    const res = http.get(`${BASE_URL}/v1/transactions?limit=20`, {
      ...headers,
      tags: { endpoint: 'transactions' },
    });
    checkOk(res, 200, 'transactions');
  }
  sleep(0.001); // yield so VU scheduling stays honest at high iteration rates
}
