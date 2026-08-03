# ICB — International Commercial Bank
## End-to-end agent execution plan

> **What this is.** A full-fidelity simulation of a retail + commercial bank: marketing site,
> client dashboard, admin/back-office console, and a NestJS + MongoDB core. Every behaviour is
> real — double-entry ledger, holds, settlement windows, interest accrual, fraud scoring,
> KYC/AML queues, disputes, statements. **No real money ever moves.** No card network, no
> ACH/SWIFT rail, no payment processor is contacted. External rails are *simulated adapters*
> with realistic latency, failure modes, and return codes.
>
> **How to use this file.** Every task below is a **task card** with a stable ID, explicit
> inputs, explicit outputs, an owned file set, and a Definition of Done. An agent claims a card,
> works only inside its owned files, and merges without coordinating with anyone else. The
> contract in Wave 0 is what makes that safe.

---

## 0. Table of contents

1. [Non-negotiables](#1-non-negotiables)
2. [Architecture](#2-architecture)
3. [Repository layout & file-ownership map](#3-repository-layout--file-ownership-map)
4. [The money model](#4-the-money-model-read-before-touching-anything-financial)
5. [Domain model](#5-domain-model)
6. [Feature inventory](#6-feature-inventory)
7. [Wave plan](#7-wave-plan)
8. [Task cards](#8-task-cards)
9. [Agent working protocol](#9-agent-working-protocol)
10. [Testing strategy](#10-testing-strategy)
11. [Security posture](#11-security-posture)
12. [Observability](#12-observability)
13. [Environments & runbook](#13-environments--runbook)
14. [Status board](#14-status-board)
15. [Glossary](#15-glossary)

---

## 1. Non-negotiables

These are invariants. A PR that breaks one is rejected regardless of how well it works.

| # | Rule |
| --- | --- |
| **N1** | **The product presents as a bank, everywhere.** No banner, watermark, or "demo" chrome, and **no copy anywhere in the product** — marketing, dashboard, console, email, or legal — describing it as anything other than a bank. The boundary is enforced in the backend and is never surfaced in the interface. `X-ICB-Environment` names the deployment (`development`/`production`), nothing more. |
| **N2** | **No real rails.** No HTTP call may leave the process to a payment, card, bank, or KYC vendor. Adapters live in `apps/api/src/simulation/rails/` and are the only place a "rail" exists. The single permitted egresses are **Resend** (transactional email) and **Cloudinary** (document/media storage) — neither of which moves money. Both bind a recording/local fallback when their keys are absent, so the system runs fully offline. |
| **N3** | **Money is an integer.** Minor units (cents/pesewas), `number` never used for a balance. `Money = { amount: bigint-safe string \| number of minor units, currency: CurrencyCode }`. Serialised over the wire as `{ minorUnits: number, currency: string, scale: number }`. |
| **N4** | **Double entry or it didn't happen.** No balance field is ever written directly. Balances are derived from `ledger_entries` and cached in `account_balances` by the ledger service only. Every `LedgerTransaction` must sum to zero per currency. |
| **N5** | **Postings are immutable.** No update, no delete on `ledger_entries`. Corrections are new reversing transactions linked by `reversesTransactionId`. |
| **N6** | **Every mutating money endpoint is idempotent.** `Idempotency-Key` header required; replays return the original response from `idempotency_records`. |
| **N7** | **Everything privileged is audited.** Admin actions, auth events, and money movement append to `audit_events` — append-only, hash-chained. |
| **N8** | **Time comes from the clock service.** No `new Date()` in domain code. Inject `ClockService`. This is what makes time-travel simulation possible. |
| **N9** | **No secrets in the repo.** `.env.example` only. Config is validated at boot by a Zod schema; the app refuses to start on a missing/invalid var. |
| **N10** | **File ownership is respected.** An agent edits only files listed under its task card. Shared files have a designated owner card. |

### Code-quality bar (enforced in CI)

- **File size** ≤ 250 lines. **Function size** ≤ 40 lines. **Cyclomatic complexity** ≤ 10.
- **Parameters** ≤ 4 — beyond that, take an options object.
- **No `any`.** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **One export per concern.** A file is a service, a controller, a schema, a mapper, or a set of
  pure functions — never a mix.
- **No magic values.** Literals live in a `*.constants.ts` beside their module.
- **No duplicated blocks** > 5 lines (SonarQube `S4144` / duplication ratio < 3%).
- **Errors are typed.** Throw a domain error class, never a bare `Error` or a string.
- **Every service method is unit-tested.** Every controller has a contract test. Coverage gate:
  **85% lines / 80% branches** on `apps/api/src/**`, **70%** on app code.
- **No commented-out code.** No `TODO` without a task ID (`// TODO(BE-31): …`).

---

## 2. Architecture

```
                       ┌───────────────────────────────────────────────┐
   Public internet ───▶│  apps/marketing   Next.js 16 · SSG/ISR        │
                       │  icb.example                                  │
                       └───────────────────────────────────────────────┘
                       ┌───────────────────────────────────────────────┐
   Customers      ───▶│  apps/client      Next.js 16 · App Router      │
                       │  app.icb.example  · RSC + server actions      │
                       └───────────────────┬───────────────────────────┘
                       ┌───────────────────┴───────────────────────────┐
   Staff          ───▶│  apps/admin       Next.js 16 · App Router      │
                       │  ops.icb.example  · RBAC-gated                │
                       └───────────────────┬───────────────────────────┘
                                           │  HTTPS · Bearer JWT · @icb/sdk
                       ┌───────────────────▼───────────────────────────┐
                       │  apps/api         NestJS 11 (Fastify)         │
                       │  ┌─────────────────────────────────────────┐  │
                       │  │ Interface   controllers · DTOs · guards │  │
                       │  ├─────────────────────────────────────────┤  │
                       │  │ Application services · use-cases · sagas│  │
                       │  ├─────────────────────────────────────────┤  │
                       │  │ Domain      entities · policies · money │  │
                       │  ├─────────────────────────────────────────┤  │
                       │  │ Infra       mongoose · cache · adapters │  │
                       │  └─────────────────────────────────────────┘  │
                       └──────┬───────────────────┬────────────────────┘
                              │                   │
                   ┌──────────▼─────────┐  ┌──────▼──────────────────┐
                   │ MongoDB 7 replica  │  │ Redis (cache, queues,   │
                   │ set (txn support)  │  │ rate limit, sessions)   │
                   └────────────────────┘  └─────────────────────────┘
```

### Stack — pinned majors

Every dependency sits on its current major. Versions are pinned exactly (no `^`) so an agent's
tree matches CI's; bumps are a deliberate PR, not a side effect of installing.

| Layer | Package | Major |
| --- | --- | --- |
| Language | `typescript` | **6** (see ADR-13) |
| Monorepo | `turbo` · `pnpm` | 2 · 10 |
| Backend | `@nestjs/*` · `fastify` · `mongoose` | 11 · 5 · 9 |
| Contracts | `zod` · `zod-openapi` · `nestjs-zod` | 4 · 6 · 5 |
| Frontend | `next` · `react` | 16 · 19 |
| Styling | `tailwindcss` | 4 |
| Data | `@tanstack/react-query` · `@tanstack/react-table` · `recharts` | 5 · 8 · 3 |
| Forms | `react-hook-form` · `@hookform/resolvers` | 7 · 5 |
| Queue / cache | `bullmq` · `ioredis` | 6 · 6 |
| Email | `resend` · `@react-email/components` | 6 · 1 |
| Media | `cloudinary` (via `@icb/media`) | 2 |
| Auth | `argon2` · `@nestjs/jwt` | 0.45 · 11 |
| Logging | `pino` · `nestjs-pino` | 10 · 4 |
| Test | `vitest` · `@playwright/test` · `fast-check` · `msw` | 4 · 1 · 4 · 2 |
| Lint | `eslint` · `typescript-eslint` · `eslint-plugin-sonarjs` | 10 · 8 · 4 |

### Managed services

| Service | Used for | Fallback without keys |
| --- | --- | --- |
| **Resend** | Every transactional email: verification, OTP, transfer receipts, statements ready, security alerts, dispute updates. | `RecordingEmailTransport` — stores the rendered message in `notifications` and logs it. Nothing is sent. |
| **Cloudinary** | KYC documents, dispute evidence, generated statement PDFs, avatars, marketing imagery. Signed direct uploads; signed, expiring delivery. | `LocalAssetStore` writing to `storage/` with the same `assetRef` shape. |

### Decisions of record

| ID | Decision | Rationale | Rejected |
| --- | --- | --- | --- |
| **ADR-01** | pnpm workspaces + Turborepo monorepo | One contract, one type system, atomic cross-cutting changes, task-level caching. | Polyrepo (contract drift), Nx (heavier than needed). |
| **ADR-02** | NestJS with **Fastify** adapter | Nest's DI/module system is what makes 25 domain modules stay readable; Fastify for throughput + native schema validation. | Express (slower), bare Fastify (loses DI). |
| **ADR-03** | MongoDB **replica set**, Mongoose ODM | Multi-document ACID transactions are mandatory for double-entry. A single-node Mongo will not do — `docker-compose` runs a 1-node RS with `--replSet`. | Standalone Mongo (no txns), Postgres (brief specifies Mongo). |
| **ADR-04** | **Double-entry ledger**, balances derived | The only model where a bank simulation stays consistent under concurrency and reversal. | Mutable `balance` field (races, unauditable). |
| **ADR-05** | **Contract-first**: `@icb/contracts` (Zod) is the single source of truth; OpenAPI + the typed SDK are generated from it | Lets frontend and backend agents work simultaneously from day one. This is the parallelism unlock. | Hand-written types on both sides (drift), OpenAPI-first (worse DX in TS). |
| **ADR-06** | **Injected `ClockService`** + `SimulationModule` | Time travel, interest accrual over months, statement generation, and reproducible demos all require controllable time. | Real clock (untestable, undemoable). |
| **ADR-07** | Access token 15 min (JWT, in memory) + refresh token 7 d (rotating, httpOnly cookie, reuse detection) | Standard high-assurance pattern; survives XSS better than localStorage JWTs. | Long-lived JWT, server sessions only. |
| **ADR-08** | **Outbox pattern** for domain events, drained by a BullMQ worker | Guarantees notification/webhook/fraud-scan side effects can't be lost or double-fired mid-transaction. | Direct emit inside txn (lost on rollback), no events (untraceable). |
| **ADR-09** | RSC + Server Actions in `apps/client`; the browser never holds a long-lived token | Tokens stay server-side in an encrypted session cookie; the API is never called from the client bundle. | Client-side SPA fetching (token exposure). |
| **ADR-10** | **Tailwind v4 + CSS custom properties from `brand/tokens`**, shared `@icb/ui` | One token source drives three apps and the brand sheet; theme switching is a data attribute. | Per-app styles (drift), CSS-in-JS (RSC friction). |
| **ADR-11** | **Resend** for all transactional email | One provider, real deliverability, React Email templates that share `@icb/ui` tokens, and a webhook for delivery/bounce state that feeds the notification log. | SMTP + Mailpit (no real delivery state), SES (heavier setup). |
| **ADR-12** | **Cloudinary** for all document and media storage | KYC documents, dispute evidence, statements, avatars and marketing imagery all need upload, transformation, and signed delivery. Cloudinary gives signed uploads, on-the-fly derivation, and access-controlled delivery without building a storage service. | Local disk (not shareable, no transforms), S3 (transforms and signing hand-rolled). |
| **ADR-13** | **TypeScript 6**, not 7 | TS 7 compiles the tree correctly but `typescript-eslint@8` refuses to load against the TS 7 API, which would take `pnpm lint` — and therefore the whole §1 quality bar — offline. TS 6 is the newest major the toolchain fully supports. Revisit when typescript-eslint ships TS 7 support. | TS 7 (breaks lint), TS 5 (a major behind). |

---

## 3. Repository layout & file-ownership map

```
icb/
├── agent_plan.md                     ← this file          OWNER: PLT-00
├── README.md                                              OWNER: PLT-00
├── package.json  pnpm-workspace.yaml  turbo.json          OWNER: PLT-01
├── docker-compose.yml  .env.example                       OWNER: PLT-02
├── brand/                            ← DONE               OWNER: DS-00
│   ├── README.md  preview.html
│   ├── logo/*.svg
│   └── tokens/{colors.json,tokens.css}
├── docs/
│   ├── adr/NNN-*.md                                       OWNER: card that made the decision
│   ├── api/openapi.json               ← generated         OWNER: SDK-02
│   └── runbook.md                                         OWNER: OPS-03
├── packages/
│   ├── contracts/                    ← THE CONTRACT       OWNER: SDK-01
│   │   └── src/{common,auth,accounts,transactions,transfers,cards,loans,
│   │             payments,kyc,admin,risk,notifications,simulation}/*.ts
│   ├── sdk/                          ← generated client   OWNER: SDK-03
│   ├── ui/                           ← design system      OWNER: DS-01..DS-06
│   ├── money/                        ← money primitives   OWNER: SDK-04
│   ├── config-eslint/  config-ts/  config-tailwind/       OWNER: PLT-01
│   └── testing/                      ← factories, fixtures OWNER: QA-01
├── apps/
│   ├── api/                          NestJS               OWNER: BE-*
│   │   └── src/
│   │       ├── main.ts  app.module.ts                     OWNER: BE-01
│   │       ├── config/                                    OWNER: BE-01
│   │       ├── common/{errors,filters,guards,interceptors,
│   │       │          decorators,pipes,pagination,utils}/  OWNER: BE-02
│   │       ├── infrastructure/{database,cache,queue,outbox}/ OWNER: BE-03
│   │       ├── modules/<domain>/                          OWNER: one card per domain
│   │       │   ├── <domain>.module.ts
│   │       │   ├── <domain>.controller.ts
│   │       │   ├── <domain>.service.ts
│   │       │   ├── application/*.use-case.ts
│   │       │   ├── domain/{entities,policies,events}/
│   │       │   ├── infrastructure/{schemas,repositories,mappers}/
│   │       │   └── __tests__/
│   │       └── simulation/{clock,rails,scenarios,seed}/   OWNER: SIM-*
│   ├── marketing/                    Next.js              OWNER: WEB-*
│   ├── client/                       Next.js              OWNER: APP-*
│   └── admin/                        Next.js              OWNER: ADM-*
└── tools/
    ├── seed/                                              OWNER: SIM-04
    └── scripts/                                           OWNER: OPS-*
```

**Ownership rule.** Two cards never list the same file. Where a shared file must grow (e.g.
`app.module.ts` importing a new domain module), the card **appends one line** in a marked region:

```ts
// ─── DOMAIN MODULES ─── agents append one import + one module ref, alphabetically ───
```

Alphabetical insertion makes conflicts trivial to auto-resolve.

---

## 4. The money model (read before touching anything financial)

### 4.1 Representation

```ts
// packages/money/src/money.ts
export interface Money {
  readonly minorUnits: number;   // integer; 12_345 === 123.45 for a scale-2 currency
  readonly currency: CurrencyCode;
}
```

- Never `float`. Never `parseFloat` on user input — parse to minor units at the edge.
- Mongo stores `Decimal128` for amounts *and* an integer `minorUnits` mirror; the integer is
  authoritative, the Decimal128 exists for aggregation pipelines.
- Allocation uses **largest-remainder** distribution so split amounts always re-sum exactly
  (`packages/money/src/allocate.ts`).
- FX: `convert(money, rate)` rounds half-even and emits an explicit `roundingDelta` that must be
  posted to the FX rounding account. Nothing is silently lost.

### 4.2 Chart of accounts

Every posting hits two internal accounts. Customer accounts are **liabilities** to the bank.

| Code | Name | Type | Normal balance |
| --- | --- | --- | --- |
| `1000` | Cash & central bank | Asset | Debit |
| `1100` | Loans receivable | Asset | Debit |
| `1200` | Card settlement receivable | Asset | Debit |
| `2000` | Customer deposits — current | Liability | Credit |
| `2010` | Customer deposits — savings | Liability | Credit |
| `2020` | Customer deposits — fixed | Liability | Credit |
| `2100` | Pending settlement (in flight) | Liability | Credit |
| `2200` | Card authorisation holds | Liability | Credit |
| `3000` | Retained earnings | Equity | Credit |
| `4000` | Fee income | Revenue | Credit |
| `4100` | Interest income | Revenue | Credit |
| `4200` | FX income | Revenue | Credit |
| `5000` | Interest expense | Expense | Debit |
| `5100` | Fraud & dispute losses | Expense | Debit |
| `9000` | FX rounding | Contra | — |
| `9900` | Suspense (must be zero at EOD) | Contra | — |

### 4.3 Transaction lifecycle

```
   INITIATED ─▶ PENDING_AUTH ─▶ AUTHORISED ─▶ POSTED ─▶ SETTLED
        │             │              │           │
        └─▶ REJECTED  └─▶ DECLINED   └─▶ EXPIRED └─▶ REVERSED ─▶ SETTLED(reversal)
```

- **AUTHORISED** places a *hold*: a posting to `2200` that reduces **available** balance but not
  **ledger** balance. `available = ledger − holds`.
- **POSTED** releases the hold and moves value.
- **SETTLED** is a batch state applied by the settlement job on the simulated rail's schedule
  (instant: immediate · internal: immediate · ACH: T+1 · wire: same-day cut-off 16:00 ·
  SWIFT: T+2 with correspondent hops).
- **REVERSED** never mutates; it writes a mirrored transaction with `reversesTransactionId`.

### 4.4 Invariants (asserted in code + a nightly job)

1. `Σ debits = Σ credits` for every `LedgerTransaction`, per currency.
2. `Σ all entries` across the whole ledger = 0 per currency.
3. `account_balances.ledgerBalance` == `Σ ledger_entries` for that account. Drift → alarm.
4. `availableBalance ≤ ledgerBalance` always.
5. Account `9900` (suspense) is zero after the end-of-day job.
6. No account goes negative unless it carries an approved `overdraftLimit`.

`BE-11` implements `LedgerIntegrityService.verify()` which asserts all six and is run by
`QA-05` in CI against a seeded database.

---

## 5. Domain model

MongoDB collections. `_id` is a ULID string (sortable, no PK contention). All money-bearing
documents carry `version` for optimistic concurrency.

| Collection | Purpose | Key fields | Notable indexes |
| --- | --- | --- | --- |
| `customers` | Person or business identity | `type`, `status`, `tier`, `profile`, `addresses[]`, `taxIds[]`, `riskRating` | `email` (unique), `status`, `riskRating` |
| `user_credentials` | Login material, separate from profile | `customerId`, `email`, `passwordHash`(argon2id), `mfa`, `failedAttempts`, `lockedUntil` | `email` (unique) |
| `sessions` | Refresh-token family | `userId`, `familyId`, `tokenHash`, `device`, `ip`, `expiresAt`, `revokedAt` | `tokenHash` (unique), TTL on `expiresAt` |
| `staff_users` | Admin/back-office operators | `email`, `roles[]`, `mfaRequired`, `lastLoginAt` | `email` (unique) |
| `kyc_cases` | Onboarding & periodic review | `customerId`, `level`, `status`, `documents[]`, `checks[]`, `decision`, `reviewer` | `status`, `customerId` |
| `products` | Product catalogue (configurable) | `code`, `kind`, `currency`, `interestRate`, `fees[]`, `limits`, `eligibility` | `code` (unique) |
| `accounts` | Customer accounts | `customerId`, `productCode`, `number`, `iban`, `currency`, `status`, `overdraftLimit`, `nickname` | `number` (unique), `customerId+status` |
| `account_balances` | Derived cache, ledger-owned | `accountId`, `currency`, `ledgerBalance`, `holdTotal`, `availableBalance`, `asOf`, `version` | `accountId+currency` (unique) |
| `ledger_transactions` | Balanced transaction header | `reference`, `type`, `status`, `initiatedBy`, `reversesTransactionId`, `metadata` | `reference` (unique), `status+createdAt` |
| `ledger_entries` | **Immutable** postings | `transactionId`, `accountRef`, `direction`, `amount`, `currency`, `valueDate`, `sequence` | `accountRef+valueDate`, `transactionId` |
| `holds` | Authorisation holds | `accountId`, `amount`, `reason`, `expiresAt`, `releasedAt`, `sourceRef` | `accountId+releasedAt`, TTL sweep |
| `transfers` | Customer-facing money movement | `type`, `fromAccountId`, `destination`, `amount`, `fx`, `status`, `rail`, `schedule`, `transactionId` | `fromAccountId+createdAt`, `status` |
| `beneficiaries` | Saved payees | `customerId`, `kind`, `name`, `details`, `verified`, `lastUsedAt` | `customerId`, `customerId+name` |
| `standing_orders` | Recurring transfers | `customerId`, `transferTemplate`, `rrule`, `nextRunAt`, `endsAt`, `status` | `nextRunAt+status` |
| `cards` | Debit/credit/virtual cards | `accountId`, `panLast4`, `panToken`, `expiry`, `status`, `controls`, `limits`, `contactless` | `accountId`, `panToken` (unique) |
| `card_authorisations` | Auth events from the simulated network | `cardId`, `merchant`, `mcc`, `amount`, `status`, `holdId`, `arn` | `cardId+createdAt` |
| `loans` | Loan accounts | `customerId`, `productCode`, `principal`, `rate`, `termMonths`, `status`, `schedule[]`, `arrears` | `customerId`, `status` |
| `loan_applications` | Underwriting pipeline | `customerId`, `requested`, `stage`, `decision`, `scorecard`, `documents[]` | `stage`, `customerId` |
| `deposits` | Fixed/term deposits | `accountId`, `principal`, `rate`, `maturityDate`, `rollover`, `status` | `maturityDate+status` |
| `bills` / `billers` | Bill pay | `billerId`, `customerRef`, `amount`, `dueDate`, `status` | `customerId+dueDate` |
| `fx_rates` | Rate table, time-series | `pair`, `rate`, `spread`, `effectiveAt` | `pair+effectiveAt` |
| `fees` / `fee_charges` | Fee schedule & applications | `code`, `basis`, `amount`, `waivers` | `code` (unique) |
| `interest_accruals` | Daily accrual rows | `accountId`, `accrualDate`, `basis`, `amount`, `postedTransactionId` | `accountId+accrualDate` (unique) |
| `statements` | Generated statements | `accountId`, `period`, `openingBalance`, `closingBalance`, `fileKey`, `generatedAt` | `accountId+period` (unique) |
| `disputes` | Chargebacks | `transactionId`, `reason`, `stage`, `evidence[]`, `provisionalCreditTxnId`, `outcome` | `stage`, `customerId` |
| `risk_events` | Fraud engine output | `subjectType`, `subjectId`, `rules[]`, `score`, `decision`, `reviewedBy` | `score`, `decision+createdAt` |
| `aml_alerts` | Screening & monitoring hits | `customerId`, `kind`, `severity`, `status`, `narrative`, `assignedTo` | `status+severity` |
| `support_tickets` / `secure_messages` | Servicing | `customerId`, `subject`, `status`, `priority`, `thread[]` | `status`, `customerId` |
| `notifications` | In-app + delivery log | `userId`, `channel`, `template`, `payload`, `state`, `sentAt`, `readAt` | `userId+createdAt`, `state` |
| `audit_events` | Append-only, hash-chained | `actor`, `action`, `subject`, `before`, `after`, `ip`, `prevHash`, `hash` | `subject`, `actor+createdAt` |
| `idempotency_records` | Replay protection | `key`, `endpoint`, `requestHash`, `response`, `status` | `key+endpoint` (unique), TTL 24h |
| `outbox_events` | Transactional outbox | `type`, `payload`, `state`, `attempts`, `availableAt` | `state+availableAt` |
| `sim_state` | Simulation control | `clockOffsetMs`, `scenario`, `railProfiles`, `chaos` | singleton |
| `feature_flags` | Runtime toggles | `key`, `enabled`, `rollout`, `audience` | `key` (unique) |

---

## 6. Feature inventory

### 6.1 Marketing site — `apps/marketing`

| Area | Pages |
| --- | --- |
| Home | Hero, product rail, trust bar, rates snapshot, testimonial, CTA |
| Personal | Current account · Savings · Fixed deposits · Debit cards · Personal loans · Mortgages |
| Business | Business current · Merchant services · Trade finance · Payroll · Business loans |
| Wealth | Investment accounts · FX · Private banking |
| Rates & fees | Live rate table (from API), fee schedule, comparison calculator |
| Tools | Loan calculator · Savings-goal calculator · FX converter · Affordability check |
| Trust | Security centre · Fraud awareness · Deposit protection · Accessibility statement |
| Company | About · Leadership · Careers (+ listings) · Newsroom · Sustainability |
| Support | Help centre (searchable) · FAQ · Branch & ATM locator (map) · Contact · Complaints |
| Legal | Terms · Privacy · Cookies · Simulation disclosure |
| Conversion | Multi-step account application → creates a real `kyc_case` + `customer` |

Requirements: SSG/ISR, Lighthouse ≥ 95 all four, full `<meta>`/OG/JSON-LD (`BankOrAccount`,
`FAQPage`, `BreadcrumbList`), sitemap, robots, WCAG 2.2 AA, prefers-reduced-motion honoured.

### 6.2 Client dashboard — `apps/client`

| Area | Detail |
| --- | --- |
| Onboarding | Signup → email verify → identity capture → document upload → liveness (simulated) → account opening → first-login tour |
| Auth | Login, MFA (TOTP + simulated SMS OTP), remembered devices, forgot/reset password, account recovery, session list, "sign out everywhere" |
| Overview | Net position, per-account cards, available vs ledger, upcoming payments, recent activity, spend-vs-last-month, quick actions |
| Accounts | Detail, balance history chart, statements, account details sheet (IBAN/SWIFT/sort code), nickname, close/freeze request, standing orders on this account |
| Transactions | Infinite list, full-text search, filters (date, amount range, type, category, status, account), running balance, receipt view, split/annotate, tag, attach note, export CSV/OFX/PDF, dispute launch |
| Transfers | Between own accounts · to ICB customer (instant) · domestic (ACH T+1) · wire (same-day) · international (SWIFT + FX quote with countdown + fee breakdown) · scheduled · recurring · bulk upload (CSV) · templates · confirmation step with rail/ETA/fee summary · MFA step-up over threshold |
| Beneficiaries | Add (with micro-deposit verification simulation), edit, delete, favourite, recent, cooling-off period on new payees |
| Cards | List, virtual card creation, PAN reveal (step-up auth, auto-hide), freeze/unfreeze, report lost/stolen → reissue, PIN set/change, per-category and per-channel controls, spend limits, travel notice, transaction feed per card |
| Payments | Billers directory, add bill, one-off pay, autopay, due reminders, payment history |
| Loans | Product browse, eligibility check, application wizard, document upload, status tracker, active loan view (schedule, next payment, payoff quote), extra/early repayment, statements |
| Savings & deposits | Open savings, goals with progress, round-up rules, open fixed deposit (term/rate matrix), maturity instructions, early withdrawal penalty preview |
| Insights | Spend by category (donut), month-over-month, merchant leaderboard, cashflow projection, budget setting + alerts, subscription detection |
| Documents | Statements archive, tax documents, letters, generated PDFs |
| Support | Ticket list + create, secure message thread with attachments, callback request, FAQ deep links, dispute tracker |
| Profile | Personal details, addresses, contact, employment, marketing preferences |
| Security | Password change, MFA enrol/reset, trusted devices, active sessions, login history, security alerts, data export request, close account request |
| Notifications | Centre with filters, per-channel preference matrix (push/email/SMS/in-app × event type), quiet hours |
| Accessibility & UX | Keyboard-complete, screen-reader labelled, dark mode, currency/locale switch, offline-tolerant reads, optimistic UI on safe actions only |

### 6.3 Admin console — `apps/admin`

| Area | Detail |
| --- | --- |
| Auth | Staff SSO-style login, mandatory MFA, IP allowlist (simulated), forced re-auth for sensitive ops |
| Dashboard | Live KPIs: balances under management, txn volume/value, new customers, approval queue depths, fraud alert rate, system health |
| Customers | Search (name/email/phone/account/IBAN), 360° profile, relationship tree, notes, flags, freeze/unfreeze, impersonate-as-read-only (audited, banner shown), lifecycle actions |
| KYC/onboarding | Work queue with SLA timers, document viewer, check results, approve/reject/request-more-info, tier assignment, periodic-review scheduler |
| Accounts | Open/close, product change, overdraft limit, interest override, manual credit/debit (dual-approval, reason mandatory), balance history, hold management |
| Transactions | Global monitor with live tail, advanced filters, drill to postings/journal view, reverse (maker-checker), manual settle, bulk export |
| Approvals | Unified maker-checker inbox: high-value transfers, manual postings, limit changes, refunds. Four-eyes enforced; self-approval blocked |
| Cards | Issue, reissue, block, PIN reset, limits, view auth history, force-expire a hold |
| Loans | Underwriting queue, scorecard view, override with justification, disbursement, restructure, write-off, arrears/collections list |
| Fraud & risk | Alert queue, rule editor (threshold/velocity/geo/device/MCC), score explainability panel, allow/deny lists, case management, block-and-notify |
| AML | Sanctions/PEP screening hits, transaction monitoring alerts, case workflow, narrative builder, SAR/CTR draft export |
| Disputes | Queue by stage, evidence viewer, provisional credit, representment simulation, outcome + auto-posting |
| Support | Ticket inbox, assignment, macros, SLA, secure-message reply, callback list |
| Products | Product CRUD, rate schedules with effective dating, fee schedules, eligibility rules, limit matrices |
| Content | Marketing rate table, FAQ/help articles, branch & ATM records, notification templates with live preview |
| Simulation control | **Time travel** (jump/advance/reset clock), run end-of-day, run interest accrual, generate statements, rail profile editor (latency/failure %), chaos toggles, scenario runner ("payday", "fraud burst", "month-end", "market open"), synthetic traffic generator, database reset-to-seed |
| Staff & access | Staff CRUD, role assignment, granular permission matrix, session revoke, action audit per user |
| Audit & reports | Searchable audit trail with hash-chain verification, regulatory report generators, ledger integrity report, reconciliation view, scheduled report exports |
| System | Feature flags, queue depths + DLQ replay, job history, health checks, config viewer (secrets redacted) |

### 6.4 Backend — `apps/api`

25 domain modules, listed with their cards in §8.

---

## 7. Wave plan

Waves gate on **contract availability**, not on code completion. After Wave 0 lands,
Waves 1–4 run fully concurrently.

| Wave | Name | Cards | Gate to exit |
| --- | --- | --- | --- |
| **0** | **Foundation & contract** | PLT-00…02, SDK-01…04, DS-00…01, BE-01…03, QA-01 | `pnpm build` green · `@icb/contracts` published to workspace · mock server serves every endpoint · CI runs |
| **1** | **Core banking** | BE-04…14, SIM-01…04 | Ledger invariants pass · seed produces a coherent bank |
| **2** | **Product & servicing** | BE-15…25 | All endpoints in the contract implemented |
| **3** | **Surfaces** | DS-02…06, WEB-01…10, APP-01…16, ADM-01…16 | Every screen renders against mock **and** live API |
| **4** | **Hardening** | QA-02…08, SEC-01…04, OPS-01…04 | Coverage gate met · a11y + perf budgets met · runbook complete |

**Parallelism after Wave 0:** ~40 cards can be in flight simultaneously. Frontend cards never
wait on backend cards — they build against `@icb/sdk` + the MSW mock generated from the same Zod
schemas, then flip an env var to hit the real API.

---

## 8. Task cards

Card format:

> **ID · Title** — *Track · Wave · Est*
> **Owns:** files this card may edit · **Needs:** cards that must be merged first ·
> **Unblocks:** cards waiting on this · **DoD:** definition of done.

### Track PLT — Platform

**PLT-00 · Plan & repo docs** — *Platform · W0 · S*
**Owns:** `agent_plan.md`, `README.md`, `docs/adr/`. **Needs:** — **Unblocks:** all.
**DoD:** this file; README with a 5-minute quickstart; ADR-01…10 written up.

**PLT-01 · Monorepo skeleton** — *Platform · W0 · M*
**Owns:** root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.editorconfig`,
`.nvmrc`, `packages/config-ts`, `packages/config-eslint`, `packages/config-tailwind`, `.prettierrc`.
**Needs:** — **Unblocks:** everything.
**DoD:** `pnpm install && pnpm build && pnpm lint && pnpm typecheck` all green on an empty tree.
ESLint enforces the §1 quality bar (`max-lines`, `complexity`, `max-params`, `no-explicit-any`,
`sonarjs/*`). Turbo pipelines: `build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`.

**PLT-02 · Local infrastructure** — *Platform · W0 · S*
**Owns:** `docker-compose.yml`, `.env.example`, `tools/scripts/dev-*.sh`, `docs/runbook.md` (stub).
**Needs:** — **Unblocks:** BE-03.
**DoD:** `docker compose up` yields MongoDB 8 **as a single-node replica set with transactions
working** + Redis 8 + mongo-express. Healthchecks defined. A script verifies
`session.startTransaction()` succeeds. Email and media are managed services (Resend, Cloudinary),
so nothing local stands in for them; without keys the app binds recording fakes and logs what it
would have sent.

**PLT-03 · CI pipeline** — *Platform · W0 · M*
**Owns:** `.github/workflows/*.yml`, `tools/scripts/ci-*.sh`.
**Needs:** PLT-01. **Unblocks:** QA-*.
**DoD:** PR workflow runs install → lint → typecheck → unit → integration (with service
containers) → build, with Turbo remote-cache-friendly ordering. Coverage uploaded and gated.
Secret scan + dependency audit block on findings.

### Track SDK — Contract

**SDK-01 · `@icb/contracts` — schemas & types** — *Contract · W0 · L* ⚠️ **critical path**
**Owns:** `packages/contracts/**`.
**Needs:** PLT-01. **Unblocks:** every BE-*, APP-*, ADM-*, WEB-* card.
**DoD:** Zod schema + inferred type for **every** request DTO, response DTO, entity view model,
enum, and error code in §5/§6. Organised one file per bounded context, barrel-exported. Includes:
`Money`, `Page<T>`, `ApiError`, `ProblemDetails` (RFC 9457), pagination/sort/filter primitives,
and the complete `ErrorCode` union. **No schema may import from `apps/`.**

**SDK-02 · OpenAPI generation** — *Contract · W0 · S*
**Owns:** `packages/contracts/scripts/build-openapi.ts`, `docs/api/openapi.json`.
**Needs:** SDK-01. **Unblocks:** SDK-03.
**DoD:** `pnpm contracts:openapi` emits a valid OpenAPI 3.1 document from the Zod schemas;
CI fails if the committed file is stale.

**SDK-03 · Typed SDK + MSW mock** — *Contract · W0 · M*
**Owns:** `packages/sdk/**`.
**Needs:** SDK-01. **Unblocks:** all frontend cards.
**DoD:** Tree-shakeable client, one method per endpoint, typed by the contract. Handles auth
header injection, refresh-on-401 (single-flight), idempotency keys, `AbortSignal`, and typed
error mapping. Ships `@icb/sdk/mock` — MSW handlers generated from the schemas with faker-backed
realistic data, so a frontend agent can build a full screen with zero backend.

**SDK-05 · `@icb/media`** — *Contract · W0 · S*
**Owns:** `packages/media/**`.
**Needs:** PLT-01. **Unblocks:** BE-07, BE-20, BE-24, APP-*, ADM-*.
**DoD:** Cloudinary wrapper: signed-upload signature minting, folder/public-id conventions per
document kind, transformation presets (document thumbnail, avatar, marketing hero), signed
delivery URL builder with expiry, MIME + size allow-lists, and an `assetRef` value type stored on
documents instead of a raw URL. Zero Cloudinary types leak past this package.

**SDK-04 · `@icb/money`** — *Contract · W0 · S*
**Owns:** `packages/money/**`.
**Needs:** PLT-01. **Unblocks:** BE-09, DS-04, all money UI.
**DoD:** `Money` type, `fromMinor`/`fromDecimalString`/`toDecimalString`, `add`/`subtract`/
`multiply`/`negate`/`compare`/`isZero`, `allocate` (largest-remainder), `convert` with explicit
rounding delta, `format(money, locale, options)`, currency registry with correct scales
(incl. JPY scale 0, KWD scale 3). Property-based tests: allocate always re-sums; no operation
loses a minor unit.

### Track BE — Backend

**BE-01 · App bootstrap & config** — *Backend · W0 · M*
**Owns:** `apps/api/src/main.ts`, `app.module.ts`, `config/**`, `apps/api/package.json`,
`nest-cli.json`, `tsconfig.json`.
**Needs:** PLT-01, SDK-01. **Unblocks:** every other BE card.
**DoD:** Nest 11 on Fastify. Zod-validated typed config (`ConfigService.get('mongo.uri')` is
type-safe; boot fails loudly on bad config). Helmet, CORS allowlist, compression, global
`ValidationPipe` backed by Zod, versioned routes (`/v1`), graceful shutdown, `/health` +
`/health/ready`. Swagger UI served from the generated OpenAPI at `/docs`.

**BE-02 · Cross-cutting primitives** — *Backend · W0 · L*
**Owns:** `apps/api/src/common/**`.
**Needs:** BE-01. **Unblocks:** every domain card.
**DoD:**
- `errors/` — `DomainError` base + `NotFound`, `Conflict`, `Forbidden`, `Unprocessable`,
  `RateLimited`, `InsufficientFunds`, `AccountFrozen`, `LimitExceeded`, each carrying a stable
  `ErrorCode` from the contract.
- `filters/` — global exception filter emitting RFC 9457 problem+json with a correlation id.
- `guards/` — `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `StepUpGuard`, `ThrottleGuard`.
- `interceptors/` — correlation-id, request/response logging with **PII redaction**,
  transaction-timing, `IdempotencyInterceptor`.
- `decorators/` — `@CurrentUser`, `@Roles`, `@Permissions`, `@RequireStepUp`, `@Idempotent`,
  `@AuditAction`.
- `pagination/` — cursor + offset helpers, `Page<T>` builder.
Each with unit tests. No file over 120 lines.

**BE-03 · Infrastructure layer** — *Backend · W0 · L*
**Owns:** `apps/api/src/infrastructure/**`.
**Needs:** BE-01, PLT-02. **Unblocks:** all repository work.
**DoD:**
- `database/` — Mongoose connection with retry/backoff, `TransactionManager.withTransaction(fn)`
  wrapping session handling + **automatic retry on `TransientTransactionError`/
  `UnknownTransactionCommitResult`**, base repository generic (`findById`, `paginate`,
  `updateWithVersion` for optimistic locking), ULID id generator, index-sync on boot.
- `cache/` — Redis module, typed `CacheService` with namespaced keys and TTL policy.
- `queue/` — BullMQ registration, base processor with retry/backoff/DLQ.
- `outbox/` — `OutboxService.publish(event, session)` (writes inside the caller's txn) +
  `OutboxDrainProcessor` with at-least-once delivery and consumer-side dedupe.

**BE-04 · Auth** — *Backend · W1 · L*
**Owns:** `apps/api/src/modules/auth/**`.
**Needs:** BE-02, BE-03, SDK-01. **Unblocks:** APP-01, ADM-01.
**DoD:** Register, verify email, login, refresh (rotating, **reuse detection revokes the whole
family**), logout, logout-all, forgot/reset password, change password, TOTP enrol/verify/disable
+ recovery codes, simulated SMS OTP, trusted-device registration, step-up challenge for sensitive
ops, session listing + revoke. argon2id hashing. Progressive lockout after 5 failures. Password
policy incl. a breached-password check against a local list. Every auth event audited.

**BE-05 · Customers** — *Backend · W1 · M* · **Owns:** `modules/customers/**`
Profile CRUD, addresses, contacts, employment, preferences, lifecycle status machine
(`PROSPECT → PENDING_KYC → ACTIVE → DORMANT → SUSPENDED → CLOSED`), business-customer fields,
customer search (admin) with a text index, PII redaction in logs, GDPR-style data export.

**BE-06 · RBAC & staff** — *Backend · W1 · M* · **Owns:** `modules/iam/**`
Staff CRUD, roles (`SUPPORT`, `TELLER`, `OPS`, `UNDERWRITER`, `FRAUD_ANALYST`, `AML_OFFICER`,
`COMPLIANCE`, `ADMIN`, `SUPER_ADMIN`), a permission matrix as data, `PermissionsGuard`
integration, **maker-checker service** (`requestApproval`/`approve`/`reject`, self-approval
blocked, expiry), staff session policy.

**BE-07 · KYC** — *Backend · W1 · M* · **Owns:** `modules/kyc/**`
Case creation, document upload via **signed direct-to-Cloudinary uploads** (the API mints the
signature; bytes never transit the API), virus-scan simulation, simulated
ID/liveness/address checks with configurable outcomes, sanctions/PEP screening against a local
list, tiering (T1 limited → T3 full), decisioning, periodic review scheduling, adverse-media
simulation. Emits `KycDecided` to the outbox.

**BE-08 · Products & pricing** — *Backend · W1 · M* · **Owns:** `modules/products/**`
Product catalogue CRUD, effective-dated rate schedules, fee schedules with basis (flat/percent/
tiered), limit matrices per product × KYC tier, eligibility rules engine, public rates endpoint
for the marketing site (cached).

**BE-09 · Ledger core** — *Backend · W1 · XL* ⚠️ **critical path** · **Owns:** `modules/ledger/**`
The heart. `LedgerService.post(command)` — accepts a balanced set of entries, validates
`Σdebits = Σcredits` per currency, writes header + immutable entries + updates
`account_balances` **inside one Mongo transaction**, with optimistic-concurrency retry.
Also: `reverse(transactionId, reason)`, `placeHold`/`releaseHold`/`expireHolds`, chart-of-accounts
registry, journal query API, `LedgerIntegrityService.verify()` asserting all six invariants of
§4.4, and a `TrialBalanceService`. **Concurrency test required:** 200 parallel transfers against
one account must leave the ledger balanced and never negative.

**BE-10 · Accounts** — *Backend · W1 · L* · **Owns:** `modules/accounts/**`
Open (number + IBAN + check-digit generation, MOD-97 valid), close (zero-balance rule), freeze/
unfreeze, status machine, nickname, overdraft limits, balance read (ledger/available/hold),
balance history time-series, account details sheet, multi-currency, per-customer limits.

**BE-11 · Transactions & journal** — *Backend · W1 · L* · **Owns:** `modules/transactions/**`
Customer-facing transaction view over the ledger: list with cursor pagination, search
(text + amount range + date + type + status + category), running balance calculation, detail with
full posting breakdown, categorisation engine (MCC + merchant + rules + user override),
merchant enrichment, notes/tags/attachments, export (CSV/OFX/PDF), receipt rendering.

**BE-12 · Transfers** — *Backend · W1 · XL* · **Owns:** `modules/transfers/**`
One use-case class per rail — `InternalTransferUseCase`, `OnUsTransferUseCase`,
`AchTransferUseCase`, `WireTransferUseCase`, `SwiftTransferUseCase` — behind a
`TransferOrchestrator` that runs a common pipeline: validate → limits → beneficiary check →
fraud score → FX quote → fee calc → hold → post → schedule settlement → notify. Scheduled +
recurring (RRULE) transfers, bulk CSV, templates, cancel-if-pending, quote endpoint with TTL,
per-rail cut-offs and business-day calendars.

**BE-13 · Beneficiaries** — *Backend · W1 · S* · **Owns:** `modules/beneficiaries/**`
CRUD, dedupe, micro-deposit verification simulation, cooling-off window on new payees,
favourites, usage stats, bulk import.

**BE-14 · FX** — *Backend · W1 · M* · **Owns:** `modules/fx/**`
Rate table with drift simulation, spread by customer tier, quote issuance with TTL + signature,
quote redemption (single use), conversion posting incl. the rounding-delta entry, historical
rate query, exposure report.

**BE-15 · Cards** — *Backend · W2 · L* · **Owns:** `modules/cards/**`
Issue (physical/virtual), PAN generation with a valid Luhn check digit, tokenised storage
(PAN encrypted at rest, only last-4 in reads), PAN reveal behind step-up, activate, freeze,
report lost/stolen → reissue, PIN set/change (hashed), controls (online/contactless/ATM/
international/per-MCC), limits (per-txn/daily/monthly), travel notices, and the **authorisation
flow**: `authorise → hold → capture → clear` with partial capture, reversal, and expiry.

**BE-16 · Loans** — *Backend · W2 · L* · **Owns:** `modules/loans/**`
Application intake, document collection, simulated credit-bureau pull, scorecard + decision
engine (approve/refer/decline with reasons), offer + acceptance, disbursement (posts to ledger),
amortisation schedule generation (annuity + reducing balance), repayment allocation
(fees → interest → principal), early/extra repayment with payoff quote, arrears ageing,
restructure, write-off, collections queue.

**BE-17 · Deposits & savings** — *Backend · W2 · M* · **Owns:** `modules/deposits/**`
Savings accounts, goals with progress + round-up rules, fixed/term deposits (term × rate matrix),
maturity instructions (roll over/transfer out), early-withdrawal penalty calculation, interest
projection.

**BE-18 · Interest & fees engine** — *Backend · W2 · L* · **Owns:** `modules/accruals/**`
Daily accrual job (ACT/365, ACT/360, 30/360 day-count conventions), tiered rate bands,
capitalisation on schedule, fee assessment (monthly maintenance, transaction, overdraft, FX,
late), waiver rules, all posting through the ledger. Idempotent per `(accountId, accrualDate)`.

**BE-19 · Bill pay** — *Backend · W2 · M* · **Owns:** `modules/billing/**`
Biller directory + categories, bill linkage and balance fetch simulation, one-off and scheduled
payment, autopay rules, due reminders, payment history, biller-side failure simulation.

**BE-20 · Statements & documents** — *Backend · W2 · M* · **Owns:** `modules/statements/**`
Monthly statement generation from ledger entries (opening/closing/turnover reconcile exactly),
PDF rendering with ICB branding, on-demand ad-hoc period, tax documents, letters
(balance confirmation, reference). Rendered PDFs are uploaded to **Cloudinary** in an
access-controlled folder; downloads are served through short-lived signed URLs minted per
request, never a public link.

**BE-21 · Notifications** — *Backend · W2 · M* · **Owns:** `modules/notifications/**`
Template registry rendered with **React Email** so templates consume the same `brand/tokens`
values as the apps. Channels: in-app, **email via Resend**, SMS simulated, push simulated.
Per-user preference matrix with quiet hours, delivery log with provider message ids, retry with
backoff, digest batching, and a **Resend webhook receiver** that folds `delivered` / `bounced` /
`complained` back into the notification record. The Resend client is wrapped in an
`EmailTransport` port so tests and offline runs bind a recording fake instead.

**BE-22 · Risk & fraud engine** — *Backend · W2 · L* · **Owns:** `modules/risk/**`
Rule engine (velocity, amount z-score vs the customer's own history, new-payee, geo-velocity,
device fingerprint, MCC risk, time-of-day, dormant-then-active), weighted scoring with an
**explainability payload** (which rules fired, each contribution), decisions
(`ALLOW` / `CHALLENGE` / `REVIEW` / `BLOCK`), allow/deny lists, case management, feedback loop
that adjusts weights, rule CRUD for admin.

**BE-23 · AML & compliance** — *Backend · W2 · M* · **Owns:** `modules/aml/**`
Sanctions/PEP/adverse-media screening on customer and counterparty, transaction monitoring
scenarios (structuring, rapid in-out, round amounts, high-risk corridor), alert queue with
severity, case workflow, narrative builder, SAR/CTR draft generation, CTR threshold aggregation.

**BE-24 · Disputes** — *Backend · W2 · M* · **Owns:** `modules/disputes/**`
Raise from a transaction, reason codes (Visa-style), stage machine
(`SUBMITTED → INVESTIGATING → PROVISIONAL_CREDIT → REPRESENTMENT → ARBITRATION → RESOLVED`),
evidence upload, provisional credit posting + clawback, SLA timers, outcome posting, customer
comms at every stage.

**BE-25 · Support & messaging** — *Backend · W2 · S* · **Owns:** `modules/support/**`
Tickets with priority/SLA/assignment, threaded secure messages with attachments, macros,
callback requests, CSAT capture.

**BE-26 · Audit** — *Backend · W1 · M* · **Owns:** `modules/audit/**`
Append-only `audit_events` with a **hash chain** (`hash = H(prevHash ‖ canonical(event))`),
`@AuditAction` decorator support, before/after diffing with PII masking, tamper-verification
endpoint, search + export.

**BE-27 · Admin aggregation API** — *Backend · W2 · M* · **Owns:** `modules/admin/**`
Read-heavy aggregate endpoints for the console: dashboard KPIs, queue depths, customer 360,
global transaction monitor, reconciliation view, report generation. Thin — orchestrates other
modules, contains no business rules of its own.

**BE-28 · Feature flags** — *Backend · W2 · S* · **Owns:** `modules/flags/**`
Flag CRUD, percentage rollout by stable hash of user id, audience targeting, evaluation endpoint,
cache with pub/sub invalidation.

### Track SIM — Simulation

**SIM-01 · Clock service** — *Simulation · W1 · S* ⚠️ **used everywhere**
**Owns:** `apps/api/src/simulation/clock/**`.
**DoD:** `ClockService.now()`, `advance(duration)`, `setTo(instant)`, `reset()`, business-day
calendar with holidays, cut-off evaluation. Offset persisted in `sim_state` so all processes
agree. An ESLint rule bans `new Date()` outside this module.

**SIM-02 · Rail adapters** — *Simulation · W1 · M* · **Owns:** `simulation/rails/**`
`InternalRail`, `AchRail` (T+1, NACHA-style return codes R01/R02/R03…), `WireRail` (same-day,
16:00 cut-off), `SwiftRail` (T+2, correspondent hops, MT103-shaped payload), `CardNetworkRail`
(auth/capture/reversal, ISO-8583-shaped response codes). Each has a configurable profile:
latency distribution, failure rate, failure-code weighting. **This is the only place a "rail"
exists.**

**SIM-03 · Scenario engine** — *Simulation · W1 · M* · **Owns:** `simulation/scenarios/**`
Named, replayable scenarios: `payday`, `month-end`, `fraud-burst`, `dispute-wave`,
`market-volatility`, `outage`, `high-load`. Each is a declarative script of timed events.
Admin-triggerable, deterministic given a seed.

**SIM-04 · Seed data** — *Simulation · W1 · L* · **Owns:** `simulation/seed/**`, `tools/seed/**`
Deterministic (seeded faker) generation of: 200 customers across all tiers and statuses, 450
accounts in 6 currencies, **18 months of realistic transaction history** (salary, rent,
groceries, subscriptions, travel, transfers between seeded customers), 120 cards with auth
history, 40 loans at various stages, 60 KYC cases across states, 30 disputes, 80 fraud alerts,
25 AML cases, staff users for every role, full product catalogue, FX history. Ledger must be
balanced afterwards — `pnpm seed && pnpm verify:ledger` is the acceptance test.
Named logins printed at the end (`demo@icb.example / Demo!2345` etc.).

**SIM-05 · End-of-day batch** — *Simulation · W2 · M* · **Owns:** `simulation/eod/**`
Ordered pipeline: expire holds → settle due rails → accrue interest → assess fees → age arrears →
run AML monitoring → generate statements (month-end) → verify ledger integrity → zero suspense →
emit EOD report. Re-runnable, idempotent per business date.

### Track DS — Design system

**DS-00 · Brand** ✅ **DONE** — `brand/**`. Logo family, tokens, brand sheet.

**DS-01 · `@icb/ui` foundation** — *Design · W0 · L* · **Owns:** `packages/ui/src/{styles,lib,primitives}`
Tailwind v4 preset bound to `brand/tokens/tokens.css`, `cn()` util, CVA variant helper, theme
provider + `data-theme` switching with no flash, focus-visible ring system, `Icon` set
(consistent 24/20/16 grid, stroke 1.5).

**DS-02 · Form primitives** — *Design · W1 · L* · **Owns:** `packages/ui/src/form/**`
Field wrapper (label/description/error/required), Input, MoneyInput (masked, minor-unit safe),
Textarea, Select, Combobox, DatePicker, DateRangePicker, RadioGroup, Checkbox, Switch, Slider,
OTPInput, FileDropzone, PasswordInput with strength meter, PhoneInput. All wired to
`react-hook-form` + Zod resolver, all keyboard-complete, all with `aria-describedby` error
association. A11y test per component.

**DS-03 · Layout & navigation** — *Design · W1 · M* · **Owns:** `packages/ui/src/layout/**`
AppShell, Sidebar (collapsible, keyboard nav), Topbar, PageHeader, Breadcrumbs, Tabs, Section,
Grid, Stack, Container, Sheet, Dialog, Drawer, Popover, DropdownMenu, Tooltip, CommandPalette.

**DS-04 · Money & data display** — *Design · W1 · L* · **Owns:** `packages/ui/src/data/**`
`Amount` (tabular, credit/debit colouring, sign convention, currency style),
`AccountNumber` (masked, reveal-on-demand), `Balance` (ledger vs available with an explainer),
DataTable (sorting, column visibility, sticky header, row selection, virtualised, CSV export),
TransactionRow, TransactionList (infinite), StatusBadge (one map for every status enum in the
contract), Timeline, DefinitionList, EmptyState, Skeleton set, Pagination, FilterBar.

**DS-05 · Charts** — *Design · W1 · M* · **Owns:** `packages/ui/src/charts/**`
Balance-over-time area, spend-by-category donut, income-vs-expense bars, sparkline, KPI stat tile,
gauge. Palette from `brand/tokens` categorical scale; accessible (patterns + labels, not colour
alone); responsive; empty and loading states.

**DS-06 · Feedback** — *Design · W1 · S* · **Owns:** `packages/ui/src/feedback/**`
Toast system, InlineAlert, ConfirmDialog, StepUpAuthDialog, ProgressSteps, ErrorBoundary
fallback, OfflineIndicator. **No simulation banner** — see N1.

### Track WEB — Marketing site

**WEB-01** shell + nav + footer + theme · **WEB-02** home · **WEB-03** personal product pages ×6 ·
**WEB-04** business + wealth pages ×8 · **WEB-05** rates & fees (live from API) ·
**WEB-06** calculators ×4 · **WEB-07** trust/security/legal pages ·
**WEB-08** company + careers + newsroom · **WEB-09** help centre + branch/ATM locator + contact ·
**WEB-10** account-application funnel (creates a real customer + KYC case) ·
**WEB-11** SEO, sitemap, JSON-LD, OG image generation, analytics events ·
**WEB-12** performance & a11y pass (Lighthouse ≥95, CLS < 0.05).
*All W3 · each owns `apps/marketing/src/app/<route>/**` + its own components folder.*

### Track APP — Client dashboard

**APP-01** auth screens (login/MFA/reset/recovery) · **APP-02** signup & onboarding wizard ·
**APP-03** app shell + nav + session handling + step-up flow · **APP-04** overview ·
**APP-05** accounts list + detail · **APP-06** transactions list, search, filters, detail, export ·
**APP-07** transfer flows (all rails, quote, confirm, receipt) · **APP-08** beneficiaries ·
**APP-09** cards · **APP-10** bill pay · **APP-11** loans (browse → apply → service) ·
**APP-12** savings, goals & deposits · **APP-13** insights & budgets · **APP-14** documents &
statements · **APP-15** support, messages & disputes · **APP-16** profile, security, notifications
& preferences.
*All W3 · each owns `apps/client/src/app/(dashboard)/<route>/**` + `src/features/<feature>/**`.*

### Track ADM — Admin console

**ADM-01** staff auth + shell + RBAC-aware nav · **ADM-02** dashboard KPIs ·
**ADM-03** customer search + 360 profile · **ADM-04** KYC queue + document viewer ·
**ADM-05** account operations (incl. dual-approval manual postings) ·
**ADM-06** transaction monitor + journal drill-down · **ADM-07** approvals inbox (maker-checker) ·
**ADM-08** card operations · **ADM-09** loan underwriting + collections ·
**ADM-10** fraud queue + rule editor + explainability · **ADM-11** AML cases + reports ·
**ADM-12** disputes · **ADM-13** support inbox · **ADM-14** product/rate/fee configuration ·
**ADM-15** content management (help, branches, templates) ·
**ADM-16** **simulation control room** (time travel, EOD, scenarios, rail profiles, chaos, reset) ·
**ADM-17** staff & permissions · **ADM-18** audit explorer + integrity verification ·
**ADM-19** system health, flags, queues, DLQ replay.
*All W3 · each owns `apps/admin/src/app/<route>/**` + `src/features/<feature>/**`.*

### Track QA / SEC / OPS

**QA-01** `@icb/testing` — factories, fixtures, in-memory Mongo harness, auth helpers *(W0)* ·
**QA-02** backend unit coverage to gate · **QA-03** API integration suite (supertest, real Mongo) ·
**QA-04** contract tests: every controller response parses against its Zod schema ·
**QA-05** ledger property + concurrency suite (the six invariants, 200-way parallel transfer) ·
**QA-06** Playwright E2E journeys: signup→KYC→account→transfer→statement; card→auth→dispute→resolve;
loan apply→approve→disburse→repay; fraud block→review→release · **QA-07** a11y automation
(axe on every route, keyboard traversal) · **QA-08** load smoke (k6, 500 rps read / 50 rps write).

**SEC-01** threat model + STRIDE doc · **SEC-02** authn/authz test suite (IDOR sweep across every
resource endpoint, privilege escalation, token replay) · **SEC-03** input hardening (NoSQL
injection, mass assignment, SSRF on document fetch, upload MIME/size validation, rate limiting) ·
**SEC-04** secrets, PII redaction verification, encryption-at-rest for PAN/PII, dependency audit.

**OPS-01** Dockerfiles (multi-stage, distroless, non-root) + compose for the full stack ·
**OPS-02** structured logging (pino, correlation ids), OpenTelemetry traces, Prometheus metrics,
`/metrics` · **OPS-03** runbook: bootstrap, seed, reset, time-travel, common failures ·
**OPS-04** backup/restore scripts + migration framework.

---

## 9. Agent working protocol

1. **Claim** — set your card's row in §14 to `🔵 in-progress` with your agent id. One card at a
   time.
2. **Read** the card's `Needs`. If a dependency isn't `✅ done`, either pick another card or build
   against `@icb/sdk/mock`.
3. **Branch** `<track>/<ID>-<slug>` — e.g. `be/BE-09-ledger-core`.
4. **Stay inside your owned files.** Need a change elsewhere? Open a *contract request* issue
   against that card's owner rather than editing it. Exception: the marked append-only regions.
5. **Contract changes go through SDK-01 only.** If your card needs a new field, add it to
   `@icb/contracts` first, in its own commit, and announce it. Never redefine a type locally.
6. **Test as you go.** A card is not done without tests. The coverage gate is per-PR, not global.
7. **Self-review against the §1 quality bar** before opening the PR. `pnpm verify` runs
   lint + typecheck + test + build for your workspace.
8. **PR body** must state: card ID, what changed, contract changes (if any), how to verify
   manually, and which §1 invariants you touched.
9. **Mark done** — update §14 to `✅ done` in the same PR.

### Commit convention
`<type>(<card-id>): <summary>` — e.g. `feat(BE-09): balanced posting with txn retry`.
Types: `feat` `fix` `refactor` `test` `docs` `chore` `perf` `sec`.

### Conflict avoidance in shared files

| File | Rule |
| --- | --- |
| `apps/api/src/app.module.ts` | Append import + module ref alphabetically in the marked region. |
| `packages/contracts/src/index.ts` | Append the barrel export alphabetically. |
| `packages/ui/src/index.ts` | Append alphabetically. |
| `apps/*/src/app/**/layout.tsx` | Owned by the shell card of that app (WEB-01 / APP-03 / ADM-01). |
| `.env.example` | Append your var to the section for your track, with a comment. |

---

## 10. Testing strategy

| Layer | Tool | Scope | Gate |
| --- | --- | --- | --- |
| Unit | Vitest | Every service method, policy, and pure function. Mocks only at the port boundary. | 85% lines / 80% branches on `apps/api/src` |
| Contract | Vitest + Zod | Every controller response is `schema.parse()`d in a test. Catches drift at compile-and-test time. | 100% of endpoints |
| Integration | Vitest + supertest + real Mongo RS | Full request → DB → response, incl. transactions and rollback. | All money paths |
| Property | fast-check | Money arithmetic, allocation, ledger balance, amortisation schedules. | Must hold for 10k cases |
| Concurrency | Custom harness | 200 parallel transfers on one account; hold/release races; idempotency replay storms. | Zero drift, zero negative |
| Component | Vitest + Testing Library | Every `@icb/ui` component: render, interaction, a11y. | 70% |
| E2E | Playwright | The four journeys in QA-06, on Chromium + WebKit, desktop + mobile viewport. | All green |
| A11y | axe-core + manual keyboard | Every route in all three apps. | Zero serious/critical |
| Perf | Lighthouse CI + k6 | Marketing ≥95; API p95 < 200 ms read, < 500 ms write under 50 rps. | Budget enforced |

**Rule:** no test asserts on a hard-coded date, a random id, or `Date.now()`. Use `ClockService`
and the seeded factories from `@icb/testing`.

---

## 11. Security posture

Simulated money still means real security practice — the point is to model a bank faithfully.

- **AuthN** — argon2id (m=64MiB, t=3, p=4), rotating refresh tokens with family reuse detection,
  TOTP + recovery codes, device binding, progressive lockout, breached-password rejection.
- **AuthZ** — deny by default. Every resource handler re-checks ownership server-side
  (`customerId` from the token, never from the body). SEC-02 sweeps every endpoint for IDOR.
- **Step-up** — PAN reveal, new payee, transfers over threshold, security-setting changes, and all
  admin destructive ops require a fresh second factor (< 5 min old).
- **Input** — Zod at the edge, Mongo operator stripping (`$`/`.` keys rejected), explicit
  allow-list mapping into Mongoose documents (no mass assignment), upload MIME sniffing + size
  caps, no user-controlled URLs fetched server-side.
- **Data** — PAN and national IDs encrypted at rest (AES-256-GCM, key from config); logs run
  through a redaction serialiser (PAN, CVV, password, token, `authorization`, DOB, national id);
  responses never include a full PAN.
- **Transport/headers** — Helmet, HSTS, strict CSP with nonces, `SameSite=Strict` auth cookies,
  CORS allowlist, no `X-Powered-By`.
- **Rate limiting** — per-IP and per-user, tighter on auth (5/min) and money movement (10/min).
- **Audit** — hash-chained, verified by ADM-18 and a nightly job.
- **Simulation safety** — a boot-time assertion refuses to start if `NODE_ENV=production` without
  `ICB_SIMULATION_ACKNOWLEDGED=true`. Outbound HTTP to non-allowlisted hosts is blocked at the
  agent level.

---

## 12. Observability

- **Logs** — pino JSON, correlation id per request propagated through queues, PII-redacted,
  level per module.
- **Traces** — OpenTelemetry auto-instrumentation for HTTP/Mongo/Redis plus manual spans around
  `LedgerService.post` and each rail adapter.
- **Metrics** — Prometheus: request duration histogram, ledger postings/sec, transfer outcomes by
  rail and status, queue depth, DLQ size, fraud decisions by outcome, EOD job duration,
  **ledger drift gauge** (must be 0).
- **Health** — `/health` (liveness), `/health/ready` (Mongo + Redis + queue), `/health/ledger`
  (integrity check, cached 60 s).
- **Admin surfacing** — ADM-19 renders queue depth, job history, DLQ replay, and flag state.

---

## 13. Environments & runbook

```bash
# 0. prerequisites: Node 22+, pnpm 9+, Docker
pnpm install
cp .env.example .env

# 1. infrastructure (Mongo replica set + Redis)
docker compose up -d
pnpm verify:infra          # asserts transactions are available

# 2. seed a whole bank with 18 months of history
pnpm seed                  # prints demo logins

# 3. run everything
pnpm dev                   # api :4000 · marketing :3000 · client :3001 · admin :3002

# useful
pnpm verify:ledger         # asserts the six invariants of §4.4
pnpm sim:advance -- 30d    # time travel
pnpm sim:eod               # run end-of-day now
pnpm sim:scenario payday
pnpm db:reset              # drop + reseed
```

| Env | Description |
| --- | --- |
| `local` | Docker compose, seeded, clock controllable, all rails instant-by-default. Resend and Cloudinary fall back to recording fakes when keys are absent. |
| `demo` | Deployed, seeded nightly, realistic rail latency, chaos off. |
| `test` | Ephemeral Mongo per run, clock frozen at `2026-01-01T00:00:00Z`. |

---

## 14. Status board

Legend: ⬜ not started · 🟡 partial · ✅ done · ⛔ blocked

**Delivered so far:** 26 backend modules · 143 routes across 35 controllers · 35 web
routes across three apps · the six ledger invariants passing continuously · 1,450 tests green
across all ten workspaces, lint and typecheck clean.

**Concurrency, settled.** The ledger test that fires 200 simultaneous postings at one account
originally dropped 179 of them: every posting writes the same balance document, and optimistic
retry turned that into a collision storm that exhausted its budget and lost the writes. Callers
now declare the balances they will touch and `TransactionManager` queues on them before opening
the transaction — same work, done once, nothing discarded. Transaction retry stays underneath for
cross-process contention. The same lock closed a time-of-check hole in transfers, where two
concurrent sends could both pass the funds check on one account.

| ID | Title | Wave | Est | Needs | Status | Agent |
| --- | --- | --- | --- | --- | --- | --- |
| PLT-00 | Plan & repo docs | 0 | S | — | ✅ | — |
| PLT-01 | Monorepo skeleton | 0 | M | — | ✅ | — |
| PLT-02 | Local infrastructure | 0 | S | — | ✅ | — |
| PLT-03 | CI pipeline | 0 | M | PLT-01 | ✅ | — |
| SDK-01 | `@icb/contracts` | 0 | L | PLT-01 | ✅ | — |
| SDK-02 | OpenAPI generation | 0 | S | SDK-01 | 🟡 | partial |
| SDK-03 | Typed SDK + MSW mock | 0 | M | SDK-01 | 🟡 | partial |
| SDK-04 | `@icb/money` | 0 | S | PLT-01 | ✅ | — |
| SDK-05 | `@icb/media` (Cloudinary) | 0 | S | PLT-01 | ✅ | — |
| DS-00 | Brand & logo | 0 | M | — | ✅ | — |
| DS-01 | `@icb/ui` foundation | 0 | L | PLT-01, DS-00 | ✅ | — |
| DS-02 | Form primitives | 1 | L | DS-01 | 🟡 | partial |
| DS-03 | Layout & navigation | 1 | M | DS-01 | 🟡 | partial |
| DS-04 | Money & data display | 1 | L | DS-01, SDK-04 | 🟡 | partial |
| DS-05 | Charts | 1 | M | DS-01 | 🟡 | partial |
| DS-06 | Feedback & banners | 1 | S | DS-01 | ✅ | — |
| BE-01 | App bootstrap & config | 0 | M | PLT-01, SDK-01 | ✅ | — |
| BE-02 | Cross-cutting primitives | 0 | L | BE-01 | ✅ | — |
| BE-03 | Infrastructure layer | 0 | L | BE-01, PLT-02 | ✅ | — |
| BE-04 | Auth | 1 | L | BE-02, BE-03 | ✅ | — |
| BE-05 | Customers | 1 | M | BE-03 | ✅ | — |
| BE-06 | RBAC & staff | 1 | M | BE-04 | 🟡 | partial |
| BE-07 | KYC | 1 | M | BE-05 | ✅ | — |
| BE-08 | Products & pricing | 1 | M | BE-03 | ✅ | — |
| BE-09 | **Ledger core** | 1 | XL | BE-03, SDK-04 | ✅ | — |
| BE-10 | Accounts | 1 | L | BE-09 | ✅ | — |
| BE-11 | Transactions & journal | 1 | L | BE-09 | ✅ | — |
| BE-12 | Transfers | 1 | XL | BE-10, BE-14, SIM-02 | ✅ | — |
| BE-13 | Beneficiaries | 1 | S | BE-05 | ✅ | — |
| BE-14 | FX | 1 | M | BE-09 | ✅ | — |
| BE-15 | Cards | 2 | L | BE-10, SIM-02 | ✅ | — |
| BE-16 | Loans | 2 | L | BE-10, BE-08 | ✅ | — |
| BE-17 | Deposits & savings | 2 | M | BE-10 | ✅ | — |
| BE-18 | Interest & fees engine | 2 | L | BE-09, SIM-01 | 🟡 | partial |
| BE-19 | Bill pay | 2 | M | BE-12 | ✅ | — |
| BE-20 | Statements & documents | 2 | M | BE-11 | ✅ | — |
| BE-21 | Notifications | 2 | M | BE-03 | ✅ | — |
| BE-22 | Risk & fraud engine | 2 | L | BE-11 | ✅ | — |
| BE-23 | AML & compliance | 2 | M | BE-11 | 🟡 | partial |
| BE-24 | Disputes | 2 | M | BE-11, BE-15 | ✅ | — |
| BE-25 | Support & messaging | 2 | S | BE-05 | 🟡 | partial |
| BE-26 | Audit | 1 | M | BE-02 | 🟡 | partial |
| BE-27 | Admin aggregation API | 2 | M | BE-11, BE-06 | ✅ | — |
| BE-28 | Feature flags | 2 | S | BE-03 | ✅ | — |
| SIM-01 | Clock service | 1 | S | BE-01 | ✅ | — |
| SIM-02 | Rail adapters | 1 | M | SIM-01 | ✅ | — |
| SIM-03 | Scenario engine | 1 | M | SIM-01 | ✅ | — |
| SIM-04 | Seed data | 1 | L | BE-09, BE-10 | ✅ | — |
| SIM-05 | End-of-day batch | 2 | M | BE-18, BE-20 | ✅ | — |
| WEB-01…12 | Marketing site | 3 | XL | DS-01…06, SDK-03 | ⬜ |  |
| APP-01…16 | Client dashboard | 3 | XL | DS-01…06, SDK-03 | ⬜ |  |
| ADM-01…19 | Admin console | 3 | XL | DS-01…06, SDK-03 | ⬜ |  |
| QA-01 | `@icb/testing` | 0 | M | PLT-01 | 🟡 | partial |
| QA-02…08 | Test suites | 4 | XL | respective tracks | ⬜ |  |
| SEC-01…04 | Security hardening | 4 | L | BE-* | ⬜ |  |
| OPS-01…04 | Ops & observability | 4 | L | BE-01 | ⬜ |  |

---

## 15. Glossary

| Term | Meaning |
| --- | --- |
| **Available balance** | `ledgerBalance − holdTotal`. What the customer can actually spend. |
| **Ledger balance** | Sum of all posted entries. Ignores holds. |
| **Hold / authorisation** | A reservation against available balance, not yet a posting of value. |
| **Posting / entry** | One immutable debit or credit line in `ledger_entries`. |
| **Transaction** | A balanced set of postings. Always sums to zero per currency. |
| **Rail** | The (simulated) network a transfer travels on: internal, on-us, ACH, wire, SWIFT, card. |
| **Cut-off** | The time after which a transfer moves to the next business day. |
| **Maker-checker** | Four-eyes control: the requester cannot approve their own request. |
| **Step-up** | Re-authentication with a second factor for a sensitive action. |
| **T+1 / T+2** | Settles one / two business days after the transaction date. |
| **MCC** | Merchant category code — drives categorisation and card controls. |
| **Suspense** | Temporary balancing account. Must be zero at end of day. |
| **Outbox** | Events written inside the DB transaction, delivered afterwards by a worker. |

---

*ICB is a simulation. No real money moves, no real rail is contacted, no real customer exists.
Every surface says so.*
