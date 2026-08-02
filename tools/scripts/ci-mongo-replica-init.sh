#!/usr/bin/env bash
# Mirrors docker-compose.yml's `mongo-init` service: idempotently initiates the
# single-node replica set the CI mongo container runs as, then waits until the
# node reports itself as a writable primary. Safe to re-run.
set -euo pipefail

CONTAINER_NAME="${MONGO_CONTAINER_NAME:-icb-mongo}"
REPLICA_SET_NAME="${REPLICA_SET_NAME:-icb-rs}"
REPLICA_MEMBER_HOST="localhost:27017"
WAIT_ATTEMPTS=30
WAIT_INTERVAL_SECONDS=2

mongosh_eval() {
  docker exec "$CONTAINER_NAME" mongosh --quiet --eval "$1"
}

wait_for() {
  # $1 = description, $2 = mongosh expression expected to print "true"
  local attempt
  for attempt in $(seq 1 "$WAIT_ATTEMPTS"); do
    if [ "$(mongosh_eval "$2" 2>/dev/null)" = "true" ]; then
      return 0
    fi
    if [ "$attempt" -eq "$WAIT_ATTEMPTS" ]; then
      echo "::error title=MongoDB::Timed out waiting for $1."
      exit 1
    fi
    sleep "$WAIT_INTERVAL_SECONDS"
  done
}

wait_for "mongod to answer pings" "db.adminCommand('ping').ok === 1"

mongosh_eval "
  try {
    rs.status();
    print('replica set already initialised');
  } catch (error) {
    rs.initiate({ _id: '$REPLICA_SET_NAME', members: [{ _id: 0, host: '$REPLICA_MEMBER_HOST' }] });
    print('replica set initiated');
  }
"

wait_for "replica set primary" "db.hello().isWritablePrimary"

echo "Replica set '$REPLICA_SET_NAME' is ready (single-node PRIMARY)."
