#!/usr/bin/env bash
# dev-reset.sh — wipe local data and start fresh (see docs/runbook.md).
#
# Destroys the Mongo/Redis volumes, re-creates the replica set, verifies transactions, and
# reseeds the bank. This is destructive: every account, customer, and ledger entry is dropped.
set -euo pipefail

cd "$(dirname "$0")/../.."

docker compose down -v
docker compose up -d
pnpm verify:infra
pnpm seed
