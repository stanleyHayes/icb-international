# ADR-02: NestJS with the Fastify adapter

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The API is organised into ~25 domain modules (ledger, transfers, cards, loans, KYC, AML, …)
built by different agents in parallel. It needs a module/DI system that keeps that many bounded
contexts readable and testable, plus an HTTP layer with the throughput and schema validation a
banking workload demands.

## Decision

NestJS 11 running on the Fastify 5 adapter. Nest provides the module system, DI container,
guards/interceptors/pipes pipeline, and testing harness; Fastify provides the HTTP server.

## Rationale

- Nest's DI/module system is what makes 25 domain modules stay readable: each domain is a module
  with explicit imports and providers, which maps directly onto the file-ownership map.
- Fastify offers markedly better throughput than Express and native schema-based validation and
  serialisation, which pairs well with the Zod contract layer.
- The guard/interceptor/pipe pipeline gives a natural home for the cross-cutting requirements:
  RBAC, idempotency, correlation ids, PII-redacting logging, RFC 9457 errors.

## Rejected alternatives

- **Express adapter** — slower, and its middleware model is weaker than Fastify's hook/schema
  system for a validation-heavy API.
- **Bare Fastify** — loses the DI container and module boundaries; with this many domains and
  agents, hand-rolled wiring would decay quickly.
