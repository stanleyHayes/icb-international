#!/usr/bin/env bash
# Runs the API integration suite against the CI Mongo replica set + Redis.
# The BE track adds `test:integration` to @icb/api; until that script exists
# this step is a no-op so the pipeline shape can land first.
set -euo pipefail

API_PACKAGE_DIR="apps/api"

if node -e "process.exit(require('./$API_PACKAGE_DIR/package.json').scripts?.['test:integration'] ? 0 : 1)"; then
  pnpm --filter @icb/api run test:integration
else
  echo "::notice title=Integration tests::@icb/api has no test:integration script yet — skipping."
fi
