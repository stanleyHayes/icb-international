# ADR-04: Double-entry ledger with derived balances

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The product simulates a real bank: transfers, holds, fees, interest, chargebacks, corrections.
The money model has to stay consistent under concurrency, support reversal without rewriting
history, and be auditable end-to-end (non-negotiables N3–N5).

## Decision

All money movement is expressed as double-entry `LedgerTransaction`s: every transaction is a set
of entries whose debits equal credits per currency. No balance field is ever written directly;
balances are derived from `ledger_entries` and cached in `account_balances` by the ledger
service only, inside the same Mongo transaction as the posting. Postings are immutable —
corrections are new reversing transactions linked by `reversesTransactionId`. Amounts are
integer minor units.

## Rationale

- It is the only model where a bank stays consistent under concurrency and reversal: the ledger
  is the truth, and any derived number can be rebuilt and verified (the six invariants in
  agent_plan.md §4.4 are checked by `LedgerIntegrityService`).
- Immutability plus reversing entries gives a complete audit trail for free — there is no
  "update" path to secure.
- Integer minor units eliminate floating-point error from every money calculation.

## Rejected alternatives

- **Mutable `balance` field** — racy under concurrent postings, impossible to audit, and
  corrections silently rewrite history.
