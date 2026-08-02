#!/usr/bin/env bash
# dev-down.sh — stop local infrastructure (see docs/runbook.md).
#
# Dev servers are stopped with Ctrl-C in their own terminal; this stops the Docker services.
# Volumes are kept, so seeded data survives. Use dev-reset.sh for a clean slate.
set -euo pipefail

cd "$(dirname "$0")/../.."

docker compose down
