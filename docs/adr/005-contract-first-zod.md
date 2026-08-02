# ADR-05: Contract-first with `@icb/contracts` (Zod)

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Frontend and backend agents work simultaneously from wave 0. They need a shared, enforceable
definition of every request DTO, response DTO, entity view model, enum, and error code before
either side exists. Hand-maintained types on two sides drift within days.

## Decision

`@icb/contracts` is the single source of truth: every API shape is a Zod 4 schema with an
inferred TypeScript type, organised one file per bounded context and barrel-exported. The
OpenAPI 3.1 document and the typed `@icb/sdk` client are generated from these schemas, and CI
fails if the generated artifacts are stale. Contract changes go through the SDK-01 card only;
no other code may redefine a contract type locally.

## Rationale

- This is the parallelism unlock: backend controllers validate against the schemas, frontends
  consume the generated SDK, and contract tests `schema.parse()` every response — drift fails at
  compile-and-test time on both sides.
- Zod gives one definition that serves runtime validation, static types, and OpenAPI generation,
  so there is nothing to keep in sync by hand.

## Rejected alternatives

- **Hand-written types on both sides** — guaranteed drift with this many parallel agents.
- **OpenAPI-first** — the spec becomes the source and TS types are generated; workable, but the
  authoring and composition DX in TypeScript is worse than Zod-first.
