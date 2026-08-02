# ADR-08: Outbox pattern for domain events

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Money movements have side effects — notifications, webhook deliveries, fraud scans — that must
happen if and only if the posting commits. Emitting events directly inside the transaction loses
them on rollback; emitting after commit risks losing them to a crash in between. Double-firing a
"transfer complete" notification is as unacceptable as losing one.

## Decision

Domain events are written to an outbox collection inside the caller's Mongo transaction
(`OutboxService.publish(event, session)`). A BullMQ worker drains the outbox with at-least-once
delivery and consumer-side dedupe, so side effects are guaranteed to fire exactly once in
effect.

## Rationale

- Atomicity: the event record commits or rolls back with the posting it describes — there is no
  window where the ledger and its side effects disagree.
- At-least-once delivery plus dedupe gives effective exactly-once semantics without distributed
  transactions.
- Every side effect becomes traceable and replayable through the outbox and the DLQ.

## Rejected alternatives

- **Direct emit inside the transaction** — events are lost on rollback or fire for postings that
  never committed.
- **No events** — side effects become untraceable, and cross-module reactions (risk scoring,
  notifications) turn into tight coupling.
