# ICB Threat Model (SEC-01)

**Scope:** the full ICB monorepo — three Next.js apps, the NestJS/Fastify API, MongoDB,
the rail adapters, and the media/email egress paths.
**Method:** STRIDE per component against the trust boundaries below; mitigations mapped
from `agent_plan.md` §11 and verified against the tree on 2026-08-03.
**Companion:** `docs/security/sec-04-audit.md` (secrets, redaction, encryption, dependencies).

Customer-shaped PII flows through this system and it implements real banking controls, so it
is threat-modelled as a bank. The operational control plane — business date, end-of-day,
scenario and rail configuration — is itself an attack surface and is modelled as such: it can
move the books, so it is treated as privileged.

---

## 1. Trust boundaries

```
                        ┌──────────────────────────────────────┐
                        │             INTERNET / USERS          │
                        │   customers · staff · anonymous web   │
                        └──────────────────┬───────────────────┘
                                           │ HTTPS
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │                                  │                                  │
┌───────▼────────┐                ┌────────▼───────┐                 ┌────────▼───────┐
│ marketing :3100 │                │  client :3101   │                 │   admin :3102   │
│ public, anon    │                │ customer app    │                 │ staff console   │
└───────┬────────┘                └────────┬───────┘                 └────────┬───────┘
        └──────────────────────────────────┼──────────────────────────────────┘
                                           │ HTTPS — access JWT (Bearer),
                                           │ httpOnly SameSite=Strict refresh cookie,
                                           │ CORS allowlist, idempotency-key,
                                           │ x-step-up-token
   ════════════════ TB2: edge → service, unauthenticated → authenticated ════
                                  ┌────────▼────────┐
                                  │   API :4100/v1   │
                                  │  NestJS/Fastify  │
                                  │  30 modules      │
                                  └──┬─────┬─────┬───┘
   ═ TB3: service → data ══════════      │      │        ══ TB5: service → third party ══
                  ┌──────────────────────┘      └─────────────────┐
        ┌─────────▼─────────┐                        ┌────────────▼────────────┐
        │  MongoDB replica   │                        │  Egress (opt-in by key)  │
        │  set               │                        │  Resend  — email         │
        │  ledger, sessions, │                        │  Cloudinary — media      │
        │  PII, enc. PAN/CVV │                        │  Local fallbacks when    │
        └───────────────────┘                        │  no key is configured    │
                                                      └─────────────────────────┘
   ═ TB4: inside the API process — simulation vs domain code ═
        ┌──────────────────────────────────────────────────────┐
        │ Rails simulation (in-process): internal / ACH / wire  │
        │ / SWIFT transfers, card-network authorisation endpoint│
        │ Simulation engine: time travel, EOD, scenarios, chaos │
        └──────────────────────────────────────────────────────┘
```

- **TB1 — user ↔ edge apps.** Anything rendered to a browser is attacker-influenced: XSS,
  CSRF, token theft. Refresh tokens never touch JS (`httpOnly` cookie).
- **TB2 — edge apps ↔ API.** The security perimeter. Every request is authenticated,
  authorised, validated, rate-limited, and (for money movement) idempotency-checked here.
  The API never trusts a `customerId` from a request body.
- **TB3 — API ↔ MongoDB.** Data-at-rest boundary, and since the Redis removal the only
  datastore boundary. PAN/CVV/TOTP secrets cross it only encrypted; logs crossing it are
  redacted first.
- **TB4 — domain ↔ simulation (in-process).** A confused-deputy boundary: simulation
  controls (time travel, EOD, scenario injection) run with the same privileges as real
  domain code. Staff-only routes and the production boot assertion guard it.
- **TB5 — API ↔ third parties.** Resend and Cloudinary are the only egress. Both are
  disabled (recording transport / local store) unless real keys are configured.

---

## 2. STRIDE per component

### 2.1 Client apps (marketing, client, admin — Next.js)

| STRIDE | Threat | Mitigation in place | Status |
| --- | --- | --- | --- |
| Spoofing | Stolen access token replayed from another client | 15-min access JWT (`JWT_ACCESS_TTL_SECONDS=900`), rotating refresh tokens with family-reuse revocation (`SessionDoc.familyId`) | Verified |
| Tampering | XSS injecting requests as the user | React escaping by default; no `dangerouslySetInnerHTML` on user data observed; refresh token unreachable from JS (`httpOnly`) | Verified (CSP: see gap G4) |
| Repudiation | User denies an action | Hash-chained audit log on the API records actor + action; correlation id ties app → API logs | Verified |
| Info disclosure | Token/PII in browser storage or URLs | Refresh token in `httpOnly, SameSite=Strict` cookie only (`auth.controller.ts:125`); responses carry `panLast4`, never a full PAN | Verified |
| DoS | Abusive client scripting | Global throttle 120 req/min per authenticated subject or IP (`throttle.constants.ts`) | Partial (gap G2) |
| Elevation | Customer calling staff endpoints | Roles/permissions guards on every staff route; deny by default | Verified (SEC-02 sweeps) |

### 2.2 API (NestJS/Fastify)

| STRIDE | Threat | Mitigation in place | Status |
| --- | --- | --- | --- |
| Spoofing | Credential stuffing, weak/reused passwords, MFA bypass | argon2id hashing; breached-password rejection (`password.service.ts:41`); TOTP + recovery codes; progressive lockout (`failedAttempts`/`lockedUntil`); device binding on sessions | Verified |
| Spoofing | Forged/step-up bypass on sensitive ops | `StepUpGuard` requires a second factor < 5 min old (`STEP_UP_TTL_SECONDS=300`) for PAN reveal, new payees, large transfers, security changes, destructive admin ops | Verified |
| Tampering | NoSQL injection / mass assignment | Zod schemas at the edge strip unknown keys (`zod-validation.pipe.ts`); queries built from allow-listed fields (e.g. `buildEntryFilter`); no dedicated `$`/`.` operator-strip middleware found — see gap G3 | Partial |
| Tampering | Double-spend / replayed money mutation | `IdempotencyInterceptor` on money paths; double-entry postings only via `LedgerService`; hash-chained audit | Verified |
| Repudiation | Insider denies an admin action | Maker–checker approvals (ADM-05/ADM-07), hash-chained audit verified by ADM-18 + nightly job | Verified |
| Info disclosure | PII/secrets in logs | Two-layer redaction: `redactPii` key filter + pino `REDACT_PATHS` + free-text `scrubText` (PAN/Bearer/email patterns) | Verified, one gap (G1) |
| Info disclosure | PAN/PII read from a database dump | AES-256-GCM field encryption with per-write random IV (PAN, CVV, TOTP secret); HMAC fingerprint for equality lookups | Verified for PAN/CVV/TOTP; DOB stored in clear (G5) |
| DoS | Request floods, oversized bodies | Throttle guard (typed `RateLimitedError` + `retryAfterSeconds`); 10 MB body limit; multipart `fileSize`/`files: 1` caps | Partial (G2: no tighter auth/money tiers) |
| Elevation | IDOR — customerId taken from the body | `customerId` always from the token (`@CurrentCustomer`), ownership re-checked server-side per query (`{ customerId, _id }` filters) | Verified (SEC-02 sweeps) |
| Elevation | SSRF via user-controlled URL fetch | No server-side fetch of user URLs; uploads are MIME-allow-listed with size caps (`packages/media/src/allow-list.ts`) | Verified |

### 2.3 MongoDB (replica set)

| STRIDE | Threat | Mitigation in place | Status |
| --- | --- | --- | --- |
| Tampering | Direct write bypassing ledger invariants | All postings go through `LedgerService` (double-entry); transactions on the replica set; audit hash chain detects after-the-fact edits | Verified |
| Info disclosure | Dump/theft of the data volume | PAN/CVV/TOTP AES-256-GCM at rest; credentials collection split from profile (`user_credentials`); token *hashes* stored, never tokens | Verified; DOB + profile PII in clear (G5) |
| Repudiation | Silent edit of history | Hash-chained audit entries, integrity verification (ADM-18, nightly) | Verified |

### 2.4 Redis (cache / queue) — removed 2026-08-21

Redis is no longer a component. The cache moved in-process (`CacheService`, a bounded map on
the simulation clock) and the BullMQ queues were dropped: the approved-postings sweep is now an
interval in the API process, and the accruals queue had no callers. The threats assessed here on
2026-08-03 are retired with the component, not mitigated:

| STRIDE | Threat | Disposition |
| --- | --- | --- |
| Info disclosure | PII cached | Retired. Cache contents never leave the API process; no separate store to dump. |
| Tampering | Poisoned cache altering money decisions | Retired as an external threat. Money decisions still re-read Mongo as the source of truth. |
| DoS | Redis unavailable | Retired. No external cache dependency to lose. |
| Spoofing | Unauthenticated network access | Retired. No cache port is exposed. |

New exposure introduced by the removal, carried as an accepted risk: the sweep and the cache are
per-process, so a multi-instance deployment would run one sweep per instance and hold divergent
caches. Idempotency in `ManualPostingsService` makes the duplicate sweep safe, and the deployment
is single-instance in practice (Render free plan). Scaling out would need this revisited: declare
`numInstances` explicitly, or move the sweep behind a leader election.

### 2.5 Rails simulation (transfers use-cases, card network, simulation engine)

| STRIDE | Threat | Mitigation in place | Status |
| --- | --- | --- | --- |
| Spoofing | Forged card-network authorisation requests | Card-network endpoint authenticates like any other route; authorisation rules in `domain/authorisation-rules.ts` | Verified |
| Tampering | Time travel / EOD run against real-looking data | Staff-only simulation control room (ADM-16); boot assertion refuses `NODE_ENV=production` without `ICB_SIMULATION_ACKNOWLEDGED=true` (`configuration.schema.ts:70`) | Verified |
| Repudiation | "The simulation did it" — untraceable scenario actions | Scenario steps write through the same ledger + audit pipeline | Verified |
| Info disclosure | Simulation chrome leaking to customers | No simulation UI in customer-facing apps; environment header `x-icb-environment` only | Verified |
| Elevation | Simulation endpoints callable by customers | Admin/staff permissions guard; deny by default | Verified |
| Egress | Code phoning real rails | No real rail integrations exist; outbound HTTP is limited to Resend/Cloudinary. The §11 "agent-level outbound allowlist" was **not found** in code — gap G6 | Partial |

### 2.6 Media & email egress (Cloudinary, Resend)

| STRIDE | Threat | Mitigation in place | Status |
| --- | --- | --- | --- |
| Info disclosure | PII emailed to the wrong place / stored in third party | Email addresses masked in logs; no PAN/CVV ever placed in templates (redaction layer + contract-level schemas) | Verified |
| Tampering | Forged Resend webhook | `RESEND_WEBHOOK_SECRET` signature verification configured | Verified |
| Info disclosure | Public document URLs | Signed URLs with short TTL (`CLOUDINARY_SIGNED_URL_TTL_SECONDS=300`) | Verified |
| DoS / abuse | Upload bombs | MIME allow-list + size caps at parser (`fastifyMultipart` limits) and in `@icb/media` | Verified |
| Spoofing | Rogue egress to attacker host | Keys optional — no key ⇒ recording transport / local store, nothing leaves the machine | Verified (network-level allowlist: gap G6) |

---

## 3. Mitigations mapped from `agent_plan.md` §11

| §11 control | Where it lives | Status on 2026-08-03 |
| --- | --- | --- |
| argon2id (m=64MiB, t=3, p=4) | `modules/auth/application/password.service.ts`, `auth.constants.ts` | Verified |
| Rotating refresh + family reuse detection | `modules/auth/application/token.service.ts`, `SessionDoc.familyId` | Verified |
| TOTP + recovery codes | `modules/auth/application/totp.service.ts`, `recoveryCodeHashes` | Verified |
| Device binding | `SessionDoc.device` | Verified |
| Progressive lockout | `UserCredentialDoc.failedAttempts/lockedUntil` | Verified |
| Breached-password rejection | `password.service.ts:41`, `auth.constants.ts` | Verified |
| Deny-by-default AuthZ, server-side ownership | `common/guards/{jwt-auth,roles,permissions}.guard.ts`, `@CurrentCustomer` | Verified |
| Step-up (<5 min) | `common/guards/step-up.guard.ts`, `STEP_UP_TTL_SECONDS=300` | Verified |
| Zod at the edge | `common/pipes/zod-validation.pipe.ts` | Verified |
| Mongo operator stripping (`$`/`.` rejected) | **Not found as a dedicated middleware** — defense is Zod narrowing + allow-list query builders | **Gap G3** |
| Mass-assignment allow-list mapping | Zod strip + explicit mappers (e.g. `card.mapper.ts`) | Verified |
| Upload MIME sniffing + size caps | `packages/media/src/allow-list.ts`, `main.ts:42` | Verified |
| No user-controlled URLs fetched server-side | No such fetch path found; uploads via signed grants | Verified |
| PAN/national ID encrypted at rest (AES-256-GCM) | `modules/cards/domain/pan-cipher.ts`, `common/crypto/field-crypto.ts` | PAN/CVV/TOTP verified; national ID is never collected; DOB in clear (G5) |
| Log redaction serialiser | `common/interceptors/redact.ts`, `common/observability/redaction.ts` | Verified, `dateOfBirth` gap (G1) |
| Responses never include a full PAN | `modules/cards/infrastructure/card.mapper.ts` (`panLast4` only) | Verified |
| Helmet, HSTS | `main.ts:35` (helmet incl. HSTS) | Verified |
| Strict CSP with nonces | API sets `contentSecurityPolicy: false` (JSON only) and defers to the apps; **no CSP found in the Next apps** | **Gap G4** |
| SameSite=Strict auth cookies | `modules/auth/auth.controller.ts:125` | Verified |
| CORS allowlist, no X-Powered-By | `main.ts:44`; Fastify sends no `X-Powered-By` | Verified |
| Rate limiting: 5/min auth, 10/min money | Global 120/min only (`throttle.constants.ts`); **no per-route tiers found** | **Gap G2** |
| Hash-chained audit | `modules/audit` (diff + chain), ADM-18 verification | Verified |
| Production simulation boot assertion | `config/configuration.schema.ts:70-77` | Verified |
| Agent-level outbound HTTP allowlist | **Not found in code** | **Gap G6** |

---

## 4. Residual risks and open gaps

| ID | Gap | Risk | Suggested owner |
| --- | --- | --- | --- |
| G1 | `redactPii` misses `dateOfBirth` (suffix list has `dob`; the real field name ends in `birth`, and pino paths don't reach `body.individual.dateOfBirth`). Tripwire: `apps/api/src/common/interceptors/redaction-gap.spec.ts` | DOB in request logs | API owner — add `dateofbirth` to `SENSITIVE_KEYS` + `*.*.dateOfBirth` pino path |
| G2 | No tighter rate limits on auth (5/min) and money (10/min) as §11 promises | Credential stuffing / money-mutation bursts fit under the global 120/min | SEC-03 |
| G3 | No dedicated Mongo operator-key stripping; relies on Zod narrowing at the edge | Any future endpoint that skips the Zod pipe can pass `$`/`$where` through | SEC-03 |
| G4 | No CSP in the Next.js apps; API disables CSP | XSS impact not bounded by CSP | WEB-01/APP-03/ADM-01 shell owners |
| G5 | DOB and profile PII stored unencrypted (loosely-typed `individual` sub-document) | Database dump exposes PII (§11 only mandates PAN + national IDs, so this is a hardening item) | BE customers owner |
| G6 | §11's "outbound HTTP blocked at the agent level" not implemented | A compromised dependency could exfiltrate to arbitrary hosts | OPS/security |
| G7 | Dependency vulnerabilities: 12 (6 high) — see `sec-04-audit.md` §4 | Mostly build-time; `find-my-way` is runtime-reachable | All — upgrade pass |

Accepted risks: Mongo network isolation is a deployment property, not code; the
demo seed passwords (`apps/api/src/simulation/seed/seed.data.ts`) are deliberate and
point at `@icb.example` personas that must never exist outside a seeded dev database.
