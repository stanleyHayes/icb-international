# ADR-03: MongoDB replica set with Mongoose

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The double-entry ledger (ADR-04) must write a transaction header, its immutable entries, and the
derived balance cache atomically. That requires multi-document ACID transactions, which MongoDB
only provides on a replica set — a standalone `mongod` cannot start one.

## Decision

MongoDB 8 running as a replica set everywhere, including local development, accessed through the
Mongoose 9 ODM. `docker-compose.yml` runs a single-node replica set (`--replSet icb-rs`) with an
idempotent init container, and `tools/scripts/verify-infra.mjs` asserts
`session.startTransaction()` succeeds. The test environment uses ephemeral replica sets per run.

## Rationale

- Multi-document ACID transactions are mandatory for double entry: partial posting is not a
  survivable failure mode for a ledger.
- Running the replica set locally (not just in CI/prod) means transaction behaviour — retries on
  `TransientTransactionError`, write concerns, rollback paths — is exercised by every developer,
  not discovered in staging.
- Mongoose gives schema enforcement, middleware, and session-aware queries that match the NestJS
  module structure.

## Rejected alternatives

- **Standalone MongoDB** — no multi-document transactions; disqualifying on its own.
- **PostgreSQL** — a strong fit for ledgers in general, but the brief specifies MongoDB.
