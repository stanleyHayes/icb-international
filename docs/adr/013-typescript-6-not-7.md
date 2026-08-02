# ADR-13: TypeScript 6, not 7

- **Status:** Accepted
- **Date:** 2026-08-02
- **Revisit:** when typescript-eslint ships TypeScript 7 support.

## Context

TypeScript 7 (the native-port toolchain) is available and compiles this tree correctly. The §1
quality bar, however, is enforced in CI through ESLint — `typescript-eslint` for type-aware
rules plus `eslint-plugin-sonarjs` — and `pnpm lint` going offline would disable the entire
quality gate, not just types.

## Decision

Pin `typescript` to major 6 (currently `6.0.3`, exact). Every package uses the shared
`@icb/config-ts` bases with `strict`, `noUncheckedIndexedAccess`, and
`exactOptionalPropertyTypes`.

## Rationale

- TS 7 compiles the tree, but `typescript-eslint@8` refuses to load against the TS 7 API, which
  takes `pnpm lint` — and therefore the whole §1 quality bar — offline.
- TS 6 is the newest major the full toolchain (compiler, typescript-eslint, Next.js, NestJS,
  Vitest) supports without degraded linting.

## Rejected alternatives

- **TypeScript 7** — breaks the lint toolchain; unacceptable while the quality bar is
  lint-enforced.
- **TypeScript 5** — fully supported but a major behind; no compensating benefit.
