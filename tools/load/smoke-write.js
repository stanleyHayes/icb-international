/**
 * QA-08 write smoke — agent_plan.md §10 perf gate: p95 < 500 ms at 50 rps.
 *
 * Exercises the transfer *quote* path (`POST /v1/transfers/quotes`) — the
 * write-shaped endpoint that validates the request, prices the rail, and
 * persists a quote, without moving money. Quoting between the demo
 * customer's own two accounts keeps the smoke side-effect-free for the
 * ledger while still hitting validation + persistence.
 *
 * Every request carries a fresh Idempotency-Key so the run measures the real
 * write path, not the replay path (N6).
 *
 * Run: k6 run tools/load/smoke-write.js   (or ./tools/load/run-smoke.sh write)
 */
import http from 'k6/http';
import { check } from 'k6';

import {
  authHeaders,
  BASE_URL,
  checkOk,
  loginAndResolveAccounts,
  uniqueIdempotencyKey,
} from './lib/common.js';

const WRITE_RPS = Number(__ENV.WRITE_RPS || 50);
const DURATION = __ENV.DURATION || '60s';

export const options = {
  scenarios: {
    quotes: {
      executor: 'constant-arrival-rate',
      rate: WRITE_RPS,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    'http_req_duration{endpoint:quote}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  return loginAndResolveAccounts();
}

export default function (data) {
  const payload = JSON.stringify({
    fromAccountId: data.fromAccountId,
    destination: { kind: 'own_account', accountId: data.toAccountId },
    amount: { minorUnits: 1000, currency: 'USD', scale: 2 },
    amountSide: 'debit',
    reference: 'QA-08 load smoke',
  });
  const res = http.post(`${BASE_URL}/v1/transfers/quotes`, payload, {
    headers: {
      ...authHeaders(data.token),
      'content-type': 'application/json',
      'idempotency-key': uniqueIdempotencyKey(),
    },
    tags: { endpoint: 'quote' },
  });
  checkOk(res, 201, 'quote');
  check(res, { 'quote id returned': (r) => !!r.json('quoteId') });
}
