#!/usr/bin/env bash
# Fails the PR if the committed OpenAPI document is stale relative to
# @icb/contracts. SDK-02 adds the root `contracts:openapi` script in parallel;
# until it exists this check skips with a notice so CI is green either way.
set -euo pipefail

if node -e "process.exit(require('./package.json').scripts?.['contracts:openapi'] ? 0 : 1)"; then
  pnpm contracts:openapi --check
else
  echo "::notice title=Contracts::contracts:openapi script not defined yet (SDK-02 in flight) — skipping staleness check."
fi
