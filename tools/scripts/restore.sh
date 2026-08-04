#!/usr/bin/env bash
# restore.sh — restore a backup made by backup.sh, then verify what came back.
#
# Destructive when combined with --drop (which is what you usually want when restoring
# over a dirty database). Without flags it restores alongside existing data and lets
# mongorestore fail on duplicate _ids rather than silently overwriting anything.
#
# Usage:
#   tools/scripts/restore.sh [--db NAME] [--drop] [--yes] [ARCHIVE]
#
# ARCHIVE defaults to the newest file in backups/. --yes skips the confirmation prompt
# (for automation); without it the script asks before touching the database.
set -euo pipefail

cd "$(dirname "$0")/../.."

DB="icb"
DROP=0
ASSUME_YES=0
ARCHIVE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) DB="$2"; shift 2 ;;
    --drop) DROP=1; shift ;;
    --yes) ASSUME_YES=1; shift ;;
    -h | --help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    -*)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
    *)
      ARCHIVE="$1"
      shift
      ;;
  esac
done

if [[ -z "$ARCHIVE" ]]; then
  ARCHIVE="$(ls -1t backups/icb-"$DB"-*.archive.gz 2>/dev/null | head -1 || true)"
fi
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "No archive found. Pass one explicitly: tools/scripts/restore.sh <archive>" >&2
  exit 1
fi

if [[ -z "${MONGO_URI:-}" && -f .env ]]; then
  MONGO_URI="$(grep -E '^MONGO_URI=' .env | head -1 | cut -d= -f2- || true)"
fi

compose_mongo_running() {
  command -v docker >/dev/null 2>&1 \
    && docker compose ps --status running --services 2>/dev/null | grep -qx mongo
}

MODE=""
if compose_mongo_running; then
  MODE="compose"
elif [[ -n "${MONGO_URI:-}" ]] && command -v mongorestore >/dev/null 2>&1; then
  MODE="host"
else
  cat >&2 <<'EOF'
No restore path available:
  - the compose service 'mongo' is not running (or Docker is unavailable), and
  - no host mongorestore + MONGO_URI to fall back on.
Fix: `docker compose up -d mongo` (or `pnpm infra:up`), then retry.
EOF
  exit 1
fi

cat <<EOF
About to restore:
  archive: $ARCHIVE
  into db: $DB ($([[ "$MODE" == compose ]] && echo "compose service 'mongo'" || echo "$MONGO_URI"))
  drop first: $([[ $DROP -eq 1 ]] && echo yes || echo no)
EOF
if [[ $ASSUME_YES -ne 1 ]]; then
  read -r -p "Proceed? [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "Aborted."; exit 1; }
fi

DROP_FLAG=()
[[ $DROP -eq 1 ]] && DROP_FLAG=(--drop)

if [[ "$MODE" == compose ]]; then
  docker compose exec -T mongo \
    mongorestore --db "$DB" --archive --gzip "${DROP_FLAG[@]}" < "$ARCHIVE"
else
  mongorestore "$MONGO_URI" --db "$DB" --archive="$ARCHIVE" --gzip "${DROP_FLAG[@]}"
fi

# Verify: compare per-collection document counts against the manifest written at backup
# time. Counts are expected to match exactly after a --drop restore; without --drop they
# must be at least the manifest counts.
MANIFEST="${ARCHIVE%.archive.gz}.manifest.txt"
count_docs() {
  local collection="$1"
  if [[ "$MODE" == compose ]]; then
    docker compose exec -T mongo mongosh --quiet "$DB" \
      --eval "print(db.getCollection('$collection').countDocuments())"
  else
    mongosh --quiet "$MONGO_URI" \
      --eval "print(db.getCollection('$collection').countDocuments())"
  fi
}

if [[ -f "$MANIFEST" ]]; then
  FAILED=0
  while read -r collection expected; do
    [[ "$collection" =~ ^[a-z_]+$ && "$expected" =~ ^[0-9]+$ ]] || continue
    actual="$(count_docs "$collection" | tail -1 | tr -d '[:space:]')"
    if [[ $DROP -eq 1 && "$actual" != "$expected" ]] \
      || [[ $DROP -eq 0 && "$actual" -lt "$expected" ]]; then
      echo "  ✗ $collection: expected $expected, found $actual" >&2
      FAILED=1
    fi
  done < "$MANIFEST"
  if [[ $FAILED -eq 1 ]]; then
    echo "Restore verification FAILED against $MANIFEST" >&2
    exit 1
  fi
  echo "Restore verified against $MANIFEST"
else
  echo "No manifest beside the archive; skipping count verification."
fi
echo "Restore complete."
