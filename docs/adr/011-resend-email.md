# ADR-11: Resend for all transactional email

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The bank sends real transactional email — verification, OTP, transfer receipts, statements
ready, security alerts, dispute updates — and the notification log needs truthful delivery
state. Non-negotiable N2 permits exactly two egresses; email is one of them. Templates should
share the brand tokens (ADR-10).

## Decision

Resend is the single email provider, with templates written in React Email so they consume the
same `brand/tokens` values as the apps. A Resend webhook receiver folds `delivered` / `bounced`
/ `complained` back into the notification record. The client is wrapped in an `EmailTransport`
port; without keys, a `RecordingEmailTransport` stores the rendered message in `notifications`
and logs it — nothing is sent.

## Rationale

- One provider with real deliverability and a delivery-state webhook gives the notification log
  truthful status instead of "presumed sent".
- React Email keeps templates in the same component/token world as the UI.
- The transport port keeps N2 enforceable: tests and offline runs bind the recording fake, and
  no code path can send except through the port.

## Rejected alternatives

- **SMTP + Mailpit** — no real delivery state; the log would lie about bounces and complaints.
- **Amazon SES** — real delivery state, but heavier setup (domain verification, sandbox,
  reputation management) than this project needs.
