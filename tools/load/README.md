# Load smoke (QA-08)

k6 smoke tests for the API performance gate in `agent_plan.md` §10:

| Path | Target rate | Budget |
| --- | --- | --- |
| Read: `GET /v1/accounts`, `GET /v1/transactions` | 500 rps | p95 < 200 ms |
| Write: `POST /v1/transfers/quotes` | 50 rps | p95 < 500 ms |

## Files

- `smoke-read.js` — alternates the two hot read paths 50/50, constant-arrival-rate
  500 rps (override `READ_RPS`), thresholds tagged per endpoint so one slow path
  cannot hide behind the other.
- `smoke-write.js` — transfer quotes between the seeded demo customer's own two
  accounts at 50 rps (override `WRITE_RPS`). Quotes validate, price, and persist
  without moving money, so the write path is exercised with zero ledger side
  effects. Every request sends a fresh `Idempotency-Key`, measuring the real
  write path rather than the replay path (N6).
- `lib/common.js` — shared login/setup: authenticates as the seeded demo user in
  k6 `setup()` and resolves the source/destination accounts. Fails fast with a
  readable message if the API is down or unseeded.
- `run-smoke.sh` — runner; pre-flights k6 and `/health/ready`, then runs one or
  both smokes. Exits non-zero when a threshold is breached, so CI can gate on it.

## Prerequisites

1. k6 installed (`which k6`; do **not** install it system-wide from this repo —
   use your own local install, e.g. `brew install k6`).
2. API running: `pnpm --filter @icb/api start:dev` (or the compiled
   `node --env-file=../../.env dist/main.js` from `apps/api`).
3. Database seeded: `pnpm seed` — the smoke logs in as `demo@icb.example` /
   `Demo!2345678` and needs that persona's two accounts to exist.

## Running

```bash
tools/load/run-smoke.sh           # read smoke, then write smoke (60s each)
tools/load/run-smoke.sh read      # read only
tools/load/run-smoke.sh write     # write only
```

Or directly, with overrides:

```bash
BASE_URL=http://localhost:4100 READ_RPS=500 DURATION=60s \
  k6 run tools/load/smoke-read.js

WRITE_RPS=50 DURATION=60s k6 run tools/load/smoke-write.js
```

Env overrides: `BASE_URL`, `DEMO_EMAIL`, `DEMO_PASSWORD`, `READ_RPS`,
`WRITE_RPS`, `DURATION`.

Note: the seeded access token lives 900 s (`JWT_ACCESS_TTL_SECONDS`); keep
`DURATION` well under that.

## Reading the results

A run prints `http_req_duration` broken down by `{endpoint:...}` tag and ends
with either silence (gate passed) or
`thresholds on metrics '...' have been crossed` plus a non-zero exit.

`dropped_iterations` means k6 ran out of VUs (`maxVUs`) because responses were
too slow — i.e. the API could not sustain the arrival rate at all; treat that
as a failure regardless of the latency percentiles.

## Baseline measurement (2026-08-03, this repo's dev machine)

Measured against the compiled API (`dist/main.js`, single node process) with
MongoDB in Docker on the same laptop:

| Run | Target | Actual | p95 | Errors | Gate |
| --- | --- | --- | --- | --- | --- |
| read | 500 rps / 60 s | ~282 rps | 2.73 s | 0.00% | FAIL |
| write | 50 rps / 60 s | ~48.7 rps | 968 ms | 0.00% | FAIL |
| read | 200 rps / 30 s | ~88 rps | 5.96 s | 0.00% | FAIL |
| read | 100 rps / 20 s | ~14 rps | 15.0 s | 3.42% | FAIL |

**Interpretation, not a verdict on the API:** idle single requests are fast
(accounts ~5 ms, quote ~4–30 ms), and latency degraded monotonically across
successive runs while the shared `icb-mongo` Docker container (plus two other
projects' Mongo containers) sat at 90–120 % CPU the whole time. These numbers
describe a contended single-process dev environment, not production capacity.
Re-run on a quiet machine (or against a scaled deployment) before drawing
conclusions about the §10 gate; the scripts and thresholds are the deliverable,
and they correctly fail non-zero when the budget is breached.
