#!/usr/bin/env bash
# Enforces the §1 coverage gates:
#   apps/api/src — 85% lines / 80% branches
#   apps/*       — 70% lines / 70% branches
# Suites that do not exist yet are skipped with a notice so early PRs stay
# green; the gate bites as soon as a suite produces a coverage summary.
set -euo pipefail

API_MIN_LINES=85
API_MIN_BRANCHES=80
APP_MIN_LINES=70
APP_MIN_BRANCHES=70
COVERAGE_SUMMARY_PATH="coverage/coverage-summary.json"

run_vitest_coverage() {
  # $1 = pnpm filter, e.g. @icb/api
  pnpm --filter "$1" exec vitest run \
    --passWithNoTests \
    --coverage \
    --coverage.reporter=text \
    --coverage.reporter=json-summary
}

check_coverage() {
  # $1 = package dir, $2 = label, $3 = min lines, $4 = min branches
  local summary="$1/$COVERAGE_SUMMARY_PATH"
  if [ ! -f "$summary" ]; then
    echo "::notice title=Coverage gate::$2 has no $COVERAGE_SUMMARY_PATH yet — skipping."
    return 0
  fi
  SUMMARY="$summary" LABEL="$2" MIN_LINES="$3" MIN_BRANCHES="$4" node <<'EOF'
const { readFileSync } = require('node:fs');
const { SUMMARY, LABEL, MIN_LINES, MIN_BRANCHES } = process.env;
const total = JSON.parse(readFileSync(SUMMARY, 'utf8')).total;
const lines = total.lines.pct;
const branches = total.branches.pct;
console.log(`${LABEL}: lines ${lines}% (gate ${MIN_LINES}%), branches ${branches}% (gate ${MIN_BRANCHES}%)`);
if (lines < Number(MIN_LINES) || branches < Number(MIN_BRANCHES)) {
  console.error(`::error title=Coverage gate::${LABEL} is below the required coverage gate.`);
  process.exit(1);
}
EOF
}

has_vitest_tests() {
  # $1 = package dir
  node -e "
    const pkg = require('./$1/package.json');
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    process.exit(pkg.scripts?.test && deps.vitest ? 0 : 1);
  "
}

if find apps/api/src -name '*.spec.ts' -print -quit | grep -q .; then
  run_vitest_coverage @icb/api
  check_coverage apps/api 'apps/api' "$API_MIN_LINES" "$API_MIN_BRANCHES"
else
  echo "::notice title=Coverage gate::apps/api has no spec files yet — skipping."
fi

for app_dir in apps/marketing apps/client apps/admin; do
  if has_vitest_tests "$app_dir"; then
    run_vitest_coverage "$(node -p "require('./$app_dir/package.json').name")"
    check_coverage "$app_dir" "$app_dir" "$APP_MIN_LINES" "$APP_MIN_BRANCHES"
  else
    echo "::notice title=Coverage gate::$app_dir has no vitest suite yet — skipping."
  fi
done
