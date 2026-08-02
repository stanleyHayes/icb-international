# ADR-06: Injected `ClockService` and the SimulationModule

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

A credible bank simulation needs time travel: interest accruing over months, statement cycles,
scheduled transfers, rail settlement windows (T+1 ACH, T+2 SWIFT), cut-offs, and reproducible
demos. None of that is testable or demoable against the wall clock (non-negotiable N8).

## Decision

Domain code never calls `new Date()`. All time comes from an injected `ClockService`
(`now()`, `advance(duration)`, `setTo(instant)`, `reset()`) provided by the SimulationModule,
with a business-day calendar, holidays, and cut-off evaluation. The offset is persisted in
`sim_state` so all processes agree. An ESLint rule bans `new Date()` outside the clock module,
and the test environment freezes the clock at `2026-01-01T00:00:00Z`.

## Rationale

- Time travel is a core demo and test capability: advancing 30 days must run the same accrual,
  settlement, and statement code that production-shaped flows use.
- Persisted, shared time keeps the API, queue workers, and EOD batch consistent with each other.
- The lint rule makes the invariant enforceable in CI rather than by code review alone.

## Rejected alternatives

- **Real clock** — untestable for anything time-dependent and undemoable; every time-based
  feature would need months of waiting or bespoke mocking.
