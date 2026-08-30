# ADR-07: Short-lived access tokens with rotating refresh tokens

- **Status:** Accepted
- **Date:** 2026-08-02

> **Updated (2026-08):** the step-up challenges referenced below were removed along with
> all MFA (TOTP, recovery codes, trusted devices). The token strategy itself — 15-minute
> access JWTs with rotating, reuse-detected refresh tokens — is unchanged; sensitive
> operations now proceed on session auth alone.

## Context

Client and admin sessions need an auth token strategy that limits the blast radius of token
theft, survives XSS better than browser-readable storage, and still allows revocation — a bank
cannot have sessions that are valid for days with no kill switch.

## Decision

Access tokens are JWTs valid for 15 minutes, held in memory (never `localStorage`). Refresh
tokens live 7 days, rotate on every use, are stored in an httpOnly cookie, and carry reuse
detection: presenting an already-rotated refresh token revokes the entire token family. Combined
with step-up challenges for sensitive operations (see agent_plan.md §11).

## Rationale

- This is the standard high-assurance pattern: a stolen access token expires in minutes, and a
  stolen refresh token is detected the moment either party replays it, at which point the whole
  family is revoked.
- httpOnly cookies keep tokens out of reach of injected scripts; rotation gives the server a
  revocation mechanism without a per-request session lookup on the access path.

## Rejected alternatives

- **Long-lived JWTs** — no practical revocation; a leak is valid for its full lifetime.
- **Server sessions only** — workable, but forces a stateful lookup on every request and
  complicates the RSC/server-action topology (ADR-09) less cleanly than short JWTs plus rotating
  refresh.
