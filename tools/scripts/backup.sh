#!/usr/bin/env bash
# backup.sh — timestamped, verified MongoDB backup of the ICB database.
#
# Primary path runs mongodump inside the compose `mongo` service, so no host tools and no
# host port mapping are needed. If Docker or the compose service is unavailable, it falls
# back to a host-installed mongodump against MONGO_URI (from the environment or .env).
# If neither works it exits non-zero with guidance — it never writes a partial archive
# and calls it a backup.
#
# Usage:
#   tools/scripts/backup.sh [--db NAME] [--out DIR]
#
# Output:
#   backups/icb-<db>-<UTC timestamp>.archive.gz   gzipped mongodump archive
#   backups/icb-<db>-<UTC timestamp>.manifest.txt counts per collection, for restore verify
set -euo pipefail

cd "$(dirname "$0")/../.."

DB="icb"
OUT_DIR="${BACKUP_DIR:-backups}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) DB="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

# Load MONGO_URI from .env for the fallback path when it is not already exported.
if [[ -z "${MONGO_URI:-}" && -f .env ]]; then
  MONGO_URI="$(grep -E '^MONGO_URI=' .env | head -1 | cut -d= -f2- || true)"
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$OUT_DIR/icb-$DB-$TIMESTAMP.archive.gz"
MANIFEST="$OUT_DIR/icb-$DB-$TIMESTAMP.manifest.txt"
mkdir -p "$OUT_DIR"

# A dump that dies mid-stream must not leave a partial archive masquerading as a backup.
cleanup_partial() {
  rm -f "$ARCHIVE.tmp"
}
trap cleanup_partial EXIT

compose_mongo_running() {
  command -v docker >/dev/null 2>&1 \
    && docker compose ps --status running --services 2>/dev/null | grep -qx mongo
}

dump_via_compose() {
  docker compose exec -T mongo \
    mongodump --db "$DB" --archive --gzip > "$ARCHIVE.tmp"
}

dump_via_host() {
  [[ -n "${MONGO_URI:-}" ]] || return 1
  command -v mongodump >/dev/null 2>&1 || return 1
  # Strip any database from the URI and pin --db explicitly, so --db always wins.
  mongodump "$MONGO_URI" --db "$DB" --archive --gzip > "$ARCHIVE.tmp"
}

MODE=""
if compose_mongo_running; then
  MODE="compose service 'mongo'"
  dump_via_compose || {
    echo "mongodump failed partway (see above); partial archive removed, nothing was kept." >&2
    exit 1
  }
elif [[ -n "${MONGO_URI:-}" ]] && command -v mongodump >/dev/null 2>&1; then
  MODE="host mongodump against MONGO_URI"
  dump_via_host || {
    echo "mongodump failed partway (see above); partial archive removed, nothing was kept." >&2
    exit 1
  }
else
  cat >&2 <<'EOF'
No backup path available:
  - the compose service 'mongo' is not running (or Docker is unavailable), and
  - no host mongodump + MONGO_URI to fall back on.
Fix: `docker compose up -d mongo` (or `pnpm infra:up`), then retry.
EOF
  exit 1
fi
mv "$ARCHIVE.tmp" "$ARCHIVE"

# Verify: the archive must be readable end-to-end. --dryRun walks the whole archive
# without touching the database; a truncated or corrupt dump fails here, not at 3am.
verify_archive() {
  if [[ "$MODE" == compose* ]]; then
    docker compose exec -T mongo \
      mongorestore --archive --gzip --dryRun < "$ARCHIVE" > /dev/null
  else
    mongorestore --archive="$ARCHIVE" --gzip --dryRun > /dev/null
  fi
}
if ! verify_archive; then
  echo "Backup FAILED verification and has been removed: $ARCHIVE" >&2
  rm -f "$ARCHIVE"
  exit 1
fi

# Manifest: document counts per collection, so restore.sh can prove it got everything back.
collections_via_compose() {
  docker compose exec -T mongo mongosh --quiet "$DB" --eval '
    db.getCollectionNames().sort().forEach((name) => {
      print(name + " " + db.getCollection(name).countDocuments());
    })'
}
collections_via_host() {
  mongosh --quiet "$MONGO_URI" --eval '
    db.getCollectionNames().sort().forEach((name) => {
      print(name + " " + db.getCollection(name).countDocuments());
    })'
}
{
  echo "# ICB backup manifest"
  echo "db=$DB"
  echo "timestamp=$TIMESTAMP"
  echo "mode=$MODE"
  if [[ "$MODE" == compose* ]]; then
    collections_via_compose || echo "# counts unavailable"
  elif command -v mongosh >/dev/null 2>&1; then
    collections_via_host || echo "# counts unavailable"
  else
    echo "# counts unavailable (no mongosh on host)"
  fi
} > "$MANIFEST"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "Backup complete ($MODE)"
echo "  archive:  $ARCHIVE ($SIZE)"
echo "  manifest: $MANIFEST"
