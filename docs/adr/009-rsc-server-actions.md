# ADR-09: RSC + Server Actions in `apps/client`

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The customer dashboard calls the API with bearer tokens. If those calls happen in the browser
bundle, tokens must live in browser-accessible storage — exactly what ADR-07's XSS posture is
trying to avoid.

## Decision

`apps/client` is built on React Server Components and Server Actions. The browser never holds a
long-lived token: tokens stay server-side in an encrypted session cookie, and the API is never
called from the client bundle. Server actions call the API through `@icb/sdk` with the
server-held credentials.

## Rationale

- Token exposure surface shrinks to the server: XSS in the client bundle cannot exfiltrate
  credentials it never sees.
- RSC also fits the read-heavy dashboard: account and transaction data render on the server with
  no client-side fetch waterfall, and server actions give mutations a natural, progressively
  enhanced home.

## Rejected alternatives

- **Client-side SPA fetching** — requires tokens in browser storage, reopening the exposure
  ADR-07 closes.
