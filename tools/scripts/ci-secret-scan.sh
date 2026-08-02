#!/usr/bin/env bash
# Secret scan with a pinned gitleaks binary (checksum-verified). Blocks the PR
# on any finding. Requires a full checkout (fetch-depth: 0) because it scans
# git history, not just the worktree.
set -euo pipefail

GITLEAKS_VERSION="8.30.1"
RELEASE_BASE="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}"
ARCHIVE="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

curl -fsSLo "$workdir/$ARCHIVE" "$RELEASE_BASE/$ARCHIVE"
curl -fsSLo "$workdir/checksums.txt" "$RELEASE_BASE/gitleaks_${GITLEAKS_VERSION}_checksums.txt"
(
  cd "$workdir"
  grep "$ARCHIVE" checksums.txt | sha256sum --check --status
)

tar -xzf "$workdir/$ARCHIVE" -C "$workdir"

"$workdir/gitleaks" git --redact --verbose .
