#!/usr/bin/env bash
# dev-up.sh — start local infrastructure and the dev servers (see docs/runbook.md).
#
# Brings up MongoDB (single-node replica set) + Redis via docker compose, asserts that
# transactions work, then starts all apps with `pnpm dev`.
# Pass --infra-only to skip starting the dev servers.
set -euo pipefail

cd "$(dirname "$0")/../.."

docker compose up -d
pnpm verify:infra

if [[ "${1:-}" == "--infra-only" ]]; then
  echo "Infrastructure is up. Start the apps with: pnpm dev"
  exit 0
fi

exec pnpm dev
