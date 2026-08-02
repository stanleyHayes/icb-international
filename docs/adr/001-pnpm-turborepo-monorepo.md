# ADR-01: pnpm workspaces + Turborepo monorepo

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

ICB ships three Next.js apps, one NestJS API, and a set of shared packages (contracts, SDK,
money, UI, config). The contract-first strategy (ADR-05) requires the API and every frontend to
compile against the exact same Zod schemas and TypeScript types, and the wave plan has many
agents landing cross-cutting changes in parallel.

## Decision

Use a single pnpm 10 workspaces monorepo orchestrated by Turborepo 2, with `packages/*`,
`apps/*`, and `tools/*` as workspace globs. Dependencies are pinned exactly and Turbo pipelines
(`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`) provide task-level caching.

## Rationale

- One contract, one type system: `@icb/contracts` is imported as `workspace:*` everywhere, so
  drift between API and frontends is a compile error, not a runtime surprise.
- Atomic cross-cutting changes: a contract change and its consumers land in one commit.
- Turbo's task graph and caching keep `pnpm verify` fast as the tree grows to 25+ modules.

## Rejected alternatives

- **Polyrepo** — the contract would be versioned and published, reintroducing exactly the drift
  the architecture exists to eliminate.
- **Nx** — capable, but heavier (plugins, generators, project graph config) than this project
  needs; Turbo covers the pipeline requirement with far less machinery.
