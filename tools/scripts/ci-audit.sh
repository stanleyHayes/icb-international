#!/usr/bin/env bash
# Blocks the PR on known vulnerabilities at or above AUDIT_LEVEL across the
# whole workspace.
set -euo pipefail

AUDIT_LEVEL="high"

pnpm audit --audit-level="$AUDIT_LEVEL"
