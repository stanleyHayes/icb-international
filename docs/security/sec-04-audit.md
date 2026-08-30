# SEC-04 Security Audit — Secrets, Redaction, Encryption, Dependencies

**Date:** 2026-08-03 · **Scope:** whole monorepo (read-only on source; one test file added)
**Method:** static reading + grep-based scans + `pnpm audit` + targeted vitest runs.
No source code was changed; the only addition is the redaction tripwire test in §2.3.

## Summary

| Area | Result |
| --- | --- |
| Secrets hygiene | **Pass** — no real secrets in the tree; `.env` gitignored; `.env.example` placeholder-only |
| PII redaction | **Pass with one confirmed gap** — `dateOfBirth` escapes both redaction layers (tripwire test added) |
| Encryption at rest | **Pass** — PAN/CVV AES-256-GCM verified; national ID never collected; DOB in clear (hardening item) |
| Dependencies | **12 vulnerabilities: 6 high, 4 moderate, 2 low** — all transitive; one runtime-reachable (`find-my-way`) |

---

## 1. Secrets hygiene

**Verdict: PASS.**

Commands run:

```sh
# Private keys, live keys, cloud access keys across all source/docs/config
grep -rnE '(sk_live|sk_test|re_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})' \
  apps packages tools docs docker-compose.yml          # → no matches

# String literals that look like assigned credentials
grep -rnE "(password|secret|apiKey|api_key|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]" \
  apps/*/src packages/*/src                            # → only seed/demo hits, below
```

Findings:

- **`.env` is gitignored.** `.gitignore` lines 9–12 cover `.env`, `.env.local`, `.env.*.local`,
  with `!.env.example` explicitly re-included. (Whether `.env` was ever *committed* in history
  was not checked — this mission forbids git commands. Recommend a one-time
  `git log --all -- .env` / `gitleaks` run by someone with git access.)
- **`.env.example` contains no real values.** JWT/cookie/session secrets are `replace-me-…`
  placeholders, `FIELD_ENCRYPTION_KEY` is 64 zeroes, and the Resend/Cloudinary keys are empty
  (empty key ⇒ recording transport / local store, so nothing egresses by default).
- **Boot-time validation** (`apps/api/src/config/configuration.schema.ts`) enforces
  `JWT_*_SECRET ≥ 32 chars`, access ≠ refresh secret, `FIELD_ENCRYPTION_KEY` = 64 hex chars,
  and refuses `NODE_ENV=production` without `ICB_SIMULATION_ACKNOWLEDGED=true`.
- **Demo passwords exist by design** in `apps/api/src/simulation/seed/seed.data.ts`
  (`Demo!2345678`, …, `@icb.example` personas, with an explicit
  `eslint-disable sonarjs/no-hardcoded-passwords`). Acceptable for a seeded demo bank;
  they must never be reused as real credentials and the file must stay out of any
  production-shaped deployment.
- No private keys, tokens, or third-party credentials anywhere in tracked source, docs,
  or `docker-compose.yml`.

## 2. PII redaction

Two layers exist, by design:

1. **`redactPii`** (`apps/api/src/common/interceptors/redact.ts`) — deep-copies request/response
   bodies logged by `LoggingInterceptor`, replacing keys matching `SENSITIVE_KEYS`
   (`pan, cvv, password, token, authorization, dob, nationalid` — case-insensitive,
   suffix-matched) with `[redacted]`, depth-capped at 8.
2. **pino layer** (`apps/api/src/common/observability/redaction.ts` + `logger.config.ts`) —
   `REDACT_PATHS` (auth/cookie/idempotency headers, `passwordHash`, `pin`,
   `pan`, `cvv`, tokens, `dateOfBirth`, `nationalId`, …) plus
   `scrubText`, which masks PAN-shaped digit runs, Bearer tokens, and emails inside
   free-text log messages.

### 2.1 Required coverage (pan / cvv / password / token / authorization / dob / nationalId)

| Key | `redactPii` (`SENSITIVE_KEYS`) | pino `REDACT_PATHS` | Free-text (`scrubText`) |
| --- | --- | --- | --- |
| pan | ✅ (+ suffix: `cardPan`) | ✅ `pan`, `*.pan` | ✅ 13–19 digit pattern → `•••• last4` |
| cvv | ✅ | ✅ `cvv`, `*.cvv` | — |
| password | ✅ | ✅ incl. `newPassword`, `currentPassword`, `passwordHash`, 2-level wildcards | — |
| token | ✅ (+ suffix: `accessToken`, `panToken`…) | ✅ access/refresh/`tokenHash`/`panToken` | ✅ Bearer pattern (≥20 chars) |
| authorization | ✅ | ✅ `req.headers.authorization` | ✅ Bearer pattern |
| dob | ⚠️ see §2.2 | ⚠️ see §2.2 | — |
| nationalId | ✅ (suffix `nationalid`) | ✅ `nationalId`, `*.nationalId` | — |

Existing tests: `redact.spec.ts` (7 tests, key coverage/nesting/depth),
`observability/__tests__/redaction.spec.ts` (9 tests, path list + scrub patterns),
`logging.interceptor.spec.ts`. Both suites pass.

### 2.2 Confirmed gap: `dateOfBirth`

The contracts and the stored profile name the field **`dateOfBirth`**
(`packages/contracts/src/customers/customers.contract.ts:27`, stored inside the
`individual` sub-document). `SENSITIVE_KEYS` matches the suffix `dob` — and
`dateofbirth` does not end with `dob`, so `redactPii` leaves it in clear. The pino layer
has `dateOfBirth` and `*.dateOfBirth`, but the interceptor logs the body nested
(`{ body: { individual: { dateOfBirth } } }` — two levels, and there is no
`*.*.dateOfBirth` path). Net effect: **a profile-update request body logs the customer's
date of birth unredacted.**

Recommended fix (not applied — source is read-only for this mission): add
`dateofbirth` to `SENSITIVE_KEYS` and a `*.*.dateOfBirth` path to `REDACT_PATHS`.

### 2.3 Tripwire test added

`apps/api/src/common/interceptors/redaction-gap.spec.ts` — two `it.fails` tests asserting
`dateOfBirth` (top-level and nested under `individual`) is redacted. Green today,
goes red when the gap is fixed (at which point drop the `.fails` markers).

```
$ pnpm vitest run src/common/interceptors/redaction-gap.spec.ts \
    src/common/interceptors/redact.spec.ts \
    src/common/observability/__tests__/redaction.spec.ts
Test Files  3 passed (3) · Tests 16 passed | 2 expected fail (18)
```

## 3. Encryption at rest

**Verdict: PASS for PAN/CVV; national ID is never collected; DOB is in clear.**

- **PAN + CVV — AES-256-GCM, verified.** `apps/api/src/modules/cards/domain/pan-cipher.ts`:
  `createCipheriv('aes-256-gcm')`, fresh random 12-byte IV per encryption (no equality
  leakage), 32-byte hex key from `FIELD_ENCRYPTION_KEY`, auth-tag verification on decrypt
  (tamper ⇒ throw, not garbage). Applied at issuance —
  `card-issuance.service.ts:158,161` stores `panEncrypted`/`cvvEncrypted`; equality
  ("no two live cards share a PAN") uses a keyed HMAC `fingerprint()`, never the
  ciphertext. Decryption happens only in the reveal path (`card-security.service.ts`),
  which runs on session auth — the step-up check that previously gated it was removed
  with MFA (2026-08).
  Responses expose only `panLast4` (`card.mapper.ts:56`).
- **Passwords / tokens — hashed, not encrypted** (argon2id; refresh/reset/verification
  tokens stored as hashes). Correct by design.
- **National ID — not collected anywhere** in the current tree; the redaction keys are
  prophylactic. If KYC starts collecting it, it must go through `FieldEncryptionService`.
- **DOB + profile PII — stored in clear** in the loosely-typed `individual` sub-document
  (`customer.schemas.ts:60`). This matches the letter of §11 (which mandates PAN and
  national IDs) but a database dump exposes DOB/address/phone. **Recommendation
  (hardening):** encrypt `individual.dateOfBirth` with `FieldEncryptionService` and keep
  a non-reversible derived value (e.g. age band) for screening.
- **Observation (not a defect):** two parallel field-crypto implementations exist —
  `modules/cards/domain/pan-cipher.ts` and `common/crypto/field-crypto.ts` — with
  different payload layouts (`iv.ct.tag` vs `v1.iv.tag.ct`). Both are correct AES-256-GCM;
  consolidating on the versioned common one would ease future key/algorithm rotation.
  Round-trip, wrong-key, tamper, and unicode cases are covered by
  `common/crypto/field-crypto.spec.ts` (passing).

## 4. Dependency audit

Command: `pnpm audit` (exit non-zero — findings present). **12 vulnerabilities:
6 high, 4 moderate, 2 low. All are transitive; none is a direct dependency.**

| Severity | Package | Advisory | Vulnerable → patched | Path | Reachability |
| --- | --- | --- | --- | --- | --- |
| high | find-my-way | GHSA-c96f-x56v-gq3h — HTTP/2 DDoS | ≤9.6.0 → ≥9.7.0 | `api>@nestjs/platform-fastify` | **Runtime (API router) — fix first** |
| high | sharp | GHSA-2fcj-gj27-279x — inherited libvips CVEs | <0.35.0 → ≥0.35.0 | `admin>next` | Runtime (image optimisation) |
| high | postcss | GHSA-6g55-p6wh-862q — arbitrary file read | ≤8.5.11 → ≥8.5.12 | `admin>next` | Build-time |
| high | postcss | GHSA-r28c-9q8g-f849 — source-map path traversal | ≤8.5.17 → ≥8.5.18 | `admin>next` | Build-time |
| high | picomatch | GHSA-c2c7-rcm5-vvqj — ReDoS via extglob | 4.0.0–4.0.3 → ≥4.0.4 | `api>@nestjs/cli>@angular-devkit/core` | Dev/build only |
| high | js-yaml | GHSA-pm4m-ph32-ghv5 — exponential parse time | 5.0.0–5.2.1 → ≥5.2.2 | `api>@nestjs/swagger` | Dev-time (OpenAPI doc gen) |
| moderate | esbuild | GHSA-67mh-4wv8-2f99 — dev-server CORS `*` | ≤0.24.2 → ≥0.25.0 | `api>tsx` | Dev only |
| moderate | ajv | GHSA-2g4f-4pwh-qvx6 — ReDoS with `$data` | <8.18.0 → ≥8.18.0 | `api>@nestjs/cli>@angular-devkit/core` | Dev/build only |
| moderate | picomatch | GHSA-3v7f-55p6-f55p — POSIX class method injection | 4.0.0–4.0.3 → ≥4.0.4 | `api>@nestjs/cli>@angular-devkit/core` | Dev/build only |
| moderate | postcss | GHSA-qx2v-qp2m-jg93 — XSS via unescaped `</style>` | <8.5.10 → ≥8.5.10 | `admin>next` | Build-time |
| low | webpack | GHSA-8fgc-7cc6-rx7x — buildHttp allow-list bypass (userinfo) | ≤5.104.0 → ≥5.104.1 | `api>@nestjs/cli` | Dev only |
| low | webpack | GHSA-38r7-794h-5758 — buildHttp redirect bypass → SSRF | <5.104.0 → ≥5.104.0 | `api>@nestjs/cli` | Dev only |

Remediation (in priority order):

1. **find-my-way** — the only finding on the request path of a listening server.
   `pnpm update @nestjs/platform-fastify` in `apps/api` (or a pnpm override pinning
   `find-my-way@^9.7.0`) and re-run the API suite.
2. **sharp** — bump Next in `apps/admin` (or override `sharp@^0.35.0`); it's a production
   dependency even though only used at image-optimisation time.
3. **postcss (×3)** — one Next bump should pull ≥8.5.18 and clear all three.
4. **@nestjs/cli chain (picomatch, ajv, webpack)** — dev-only; update `@nestjs/cli`
   in `apps/api` (or drop it if only used for scaffolding).
5. **esbuild via tsx** — dev-only; update `tsx`.

Re-run `pnpm audit` after the bumps; expected residual: zero high at runtime.

## 5. Additional observations (out of scope, reported not fixed)

- **Rate-limit tiers missing.** §11 promises 5/min on auth and 10/min on money movement;
  only the global 120/min window exists (`common/guards/throttle.constants.ts`). → SEC-03.
- **No dedicated Mongo operator stripping** (`$`/`.` key rejection) middleware found;
  the effective defense is Zod narrowing at the edge plus allow-list query builders.
  Any future endpoint that skips the Zod pipe re-opens NoSQL injection. → SEC-03.
- **No CSP in the Next.js apps** (`Content-Security-Policy` not found in
  `apps/{client,admin,marketing}`); the API disables CSP because it serves JSON only
  (`main.ts:36`). → app shell owners.
- **§11's "agent-level outbound HTTP allowlist" not found in code.** Egress is limited
  to Resend/Cloudinary by configuration (no key ⇒ local fallback), but nothing blocks a
  compromised dependency from dialling out. → OPS/security.

## Appendix — verification commands

```sh
pnpm audit                                        # 12 findings (6 high / 4 moderate / 2 low)
cd apps/api && pnpm vitest run \
  src/common/interceptors/redaction-gap.spec.ts \
  src/common/interceptors/redact.spec.ts \
  src/common/observability/__tests__/redaction.spec.ts
                                                  # 3 files passed; 16 passed + 2 expected-fail
cd apps/api && pnpm vitest run src/common/crypto/field-crypto.spec.ts   # see §3 note
```

No infrastructure (Mongo/Redis) was required for any check in this audit.
