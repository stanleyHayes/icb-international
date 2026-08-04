#!/usr/bin/env bash
# QA-08 load smoke runner — agent_plan.md §10 perf gate.
#
# Usage:
#   tools/load/run-smoke.sh [read|write|all]     # default: all
#
# Env overrides:
#   BASE_URL       API base URL          (default http://localhost:4100)
#   DEMO_EMAIL     seeded customer email (default demo@icb.example)
#   DEMO_PASSWORD  seeded customer pass  (default Demo!2345678)
#   READ_RPS       read target rate      (default 500)
#   WRITE_RPS      write target rate     (default 50)
#   DURATION       per-scenario duration (default 60s)
#
# Exits non-zero if any smoke run breaches its thresholds, so CI can gate on it.
set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-all}"
BASE_URL="${BASE_URL:-http://localhost:4100}"

if ! command -v k6 >/dev/null 2>&1; then
  echo "error: k6 is not installed. Install it locally (e.g. 'brew install k6')" >&2
  echo "       or run via Docker: docker run --rm -i grafana/k6 run - <smoke-read.js" >&2
  exit 127
fi

# Cheap pre-flight: fail fast with a clear message instead of 60s of 0 ms "requests".
if ! curl -sf -m 5 "${BASE_URL}/health/ready" >/dev/null 2>&1; then
  echo "error: API not ready at ${BASE_URL} (/health/ready failed)." >&2
  echo "       Start it with 'pnpm --filter @icb/api start:dev' and seed with 'pnpm seed'." >&2
  exit 2
fi

run() {
  local name="$1" script="$2"
  echo "==> ${name} smoke against ${BASE_URL} (duration ${DURATION:-60s})"
  k6 run --summary-trend-stats 'min,avg,med,p(90),p(95),p(99),max' "$script"
}

case "$MODE" in
  read)  run read  smoke-read.js ;;
  write) run write smoke-write.js ;;
  all)   run read  smoke-read.js && run write smoke-write.js ;;
  *)
    echo "usage: $0 [read|write|all]" >&2
    exit 64
    ;;
esac
