#!/usr/bin/env bash
# Starts MongoDB as a single-node replica set, mirroring the `mongo` service in
# docker-compose.yml. GitHub service containers cannot pass a command to an
# image, and mongod needs --replSet for multi-document transactions, so CI
# starts the container itself.
set -euo pipefail

MONGO_IMAGE="mongo:8"
CONTAINER_NAME="${MONGO_CONTAINER_NAME:-icb-mongo}"
REPLICA_SET_NAME="${REPLICA_SET_NAME:-icb-rs}"
MONGO_PORT="${MONGO_PORT:-27017}"

docker run --detach \
  --name "$CONTAINER_NAME" \
  --publish "$MONGO_PORT:27017" \
  "$MONGO_IMAGE" \
  mongod --replSet "$REPLICA_SET_NAME" --bind_ip_all --port 27017

echo "Started $CONTAINER_NAME ($MONGO_IMAGE, replSet $REPLICA_SET_NAME) on port $MONGO_PORT"
