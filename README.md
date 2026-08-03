# ICB — International Commercial Bank

A full-fidelity banking platform: marketing site, customer dashboard, operations console, and a
NestJS + MongoDB core built on a real double-entry ledger.

Everything behaves the way a bank does — balanced postings, authorisation holds, settlement
windows, interest accrual, KYC tiers that actually gate limits, card controls enforced during
authorisation, fraud scoring with explainability, disputes with provisional credit. No external
payment network is ever contacted; rails are adapters with realistic latency, cut-offs and return
codes. See [`agent_plan.md`](agent_plan.md) for the architecture and the task board.

---

## Quickstart

```bash
# 0. Prerequisites: Node 22+, pnpm 10+, Docker
pnpm install
cp .env.example .env

# 1. Infrastructure — MongoDB 8 replica set (transactions are mandatory) + Redis 8
pnpm infra:up
pnpm verify:infra          # asserts multi-document transactions actually work

# 2. Build, then seed a bank with 18 months of history
pnpm --filter "./packages/**" build
pnpm --filter @icb/api build
pnpm seed                  # prints demo logins and proves the ledger balances

# 3. Run everything
pnpm dev
```

| Surface | URL |
| --- | --- |
| Marketing site | http://localhost:3100 |
| Customer dashboard | http://localhost:3101 |
| Operations console | http://localhost:3102 |
| API | http://localhost:4100/v1 |
| Health | http://localhost:4100/health · `/health/ready` |

### Demo logins

| Email | Password | Role |
| --- | --- | --- |
| `demo@icb.example` | `Demo!2345678` | Customer — USD, 18 months of history |
| `kwame@icb.example` | `Kwame!2345678` | Customer — GHS |
| `lena@icb.example` | `Lena!23456789` | Customer — EUR |
| `olu@icb.example` | `Olu!234567890` | Customer — USD, private tier |
| `sara@icb.example` | `Sara!234567890` | Customer — GBP |
| `ops@icb.example` | `Staff!2345678` | Operations + admin |
| `risk@icb.example` | `Staff!2345678` | Fraud analyst |
| `aml@icb.example` | `Staff!2345678` | AML officer + compliance |
| `lend@icb.example` | `Staff!2345678` | Underwriter |
| `root@icb.example` | `Staff!2345678` | Super admin |

Customers sign in at **3101**, staff at **3102**.

---

## The ledger

Not a balance column — a double-entry ledger with immutable postings, atomic multi-document
transactions, per-account write serialisation, and six invariants asserted on demand, at the end
of every business day, and from the operations console:

```bash
pnpm verify:ledger
```

```
✓ Every transaction balances per currency
✓ Whole ledger nets to zero per currency          EUR: 0, USD: 0, GHS: 0, GBP: 0
✓ Cached balances match computed balances         No drift
✓ Available balance never exceeds ledger balance
✓ Suspense account is zero
✓ No account is negative without an overdraft limit
  BALANCED
```

Balances are never assigned. `LedgerService` is the only code that may write `ledger_entries` or
`account_balances`, every product module posts through it, and a transaction that does not sum to
zero per currency is rejected before it reaches the database.

### Concurrency

Postings against one account are serial by nature — they all read and write the same balance
document. Left to optimistic retry alone, 200 simultaneous postings dropped 179 of themselves:
each collision burns an attempt, and once the budget runs out the write is simply lost.

So callers declare the balances they will touch, and `TransactionManager` queues on them before
the transaction opens. Same total work, nothing discarded, and accounts that share nothing still
run in parallel. Transaction retry remains underneath as the backstop for cross-process
contention. The proof lives in
[ledger-concurrency.spec.ts](apps/api/src/modules/ledger/__tests__/ledger-concurrency.spec.ts),
which fires 200 concurrent postings at one account against a real replica set and requires every
one of them to land with the invariants still intact.

## What is built

**Packages** — `@icb/money` (integer minor units, 15 currencies, largest-remainder allocation,
FX with an explicit rounding delta; 53 tests, 98% coverage) · `@icb/contracts` (Zod schemas for
every bounded context — one source of truth for the API and all three apps) · `@icb/ui` (design
system bound to `brand/tokens`) · `@icb/media` (Cloudinary, with a local store when keys are
absent) · `@icb/sdk` · `@icb/testing`.

**API** — 20+ domain modules across 143 routes and 35 controllers:

| Area | Modules |
| --- | --- |
| Core | ledger (postings, holds, reversal, journal, trial balance, integrity), accounts, transactions, transfers |
| Identity | auth (argon2id, rotating refresh with family-reuse detection, step-up), customers, KYC (tiered limits, screening, review queue) |
| Products | cards (PAN encrypted at rest, controls enforced at authorisation, auth → hold → capture), loans (amortisation, explainable scorecard, arrears), savings goals and term deposits, bill pay, FX, products/pricing |
| Servicing | notifications (**Resend**, with a recording transport offline), documents and statements (**Cloudinary**, PDF written from the ledger), beneficiaries with cooling-off and micro-deposit verification |
| Risk | fraud rule engine with per-rule attribution, risk cases, disputes with provisional credit |
| Operations | admin aggregation, customer directory, simulation control (clock, rails, scenarios, end-of-day, feature flags) |

**Apps** — marketing (12 routes, statically prerendered), customer dashboard (15 routes),
operations console (8 routes). All server-rendered against the live API; the access token lives
in an AES-256-GCM sealed cookie and never reaches the browser.

**Cross-cutting** — RFC 9457 problem details on every error · structured logging with two-layer
PII redaction · correlation ids through requests, jobs and audit entries · role-gated staff
endpoints · Dockerfiles (multi-stage, non-root) · CI running lint, types, unit tests, a real
replica-set integration job, a production build, and a secret scan.

### Honest gaps

MFA enrolment, the maker-checker approvals inbox, AML case management, secure messaging, and
several admin queues (loans, risk, disputes, simulation control room) have contracts and task
cards but no screens yet. `agent_plan.md` marks each 🟡 or ⬜.

## Non-negotiables

Encoded in lint and CI, not just prose — see [`agent_plan.md` §1](agent_plan.md#1-non-negotiables).

- Money is an **integer** in minor units. Never a float.
- **Double entry or it didn't happen.** No code outside `LedgerService` writes a balance.
- Postings are **immutable**. Corrections are reversing transactions; both stay on the statement.
- Time comes from `ClockService`. A zero-argument `new Date()` is a lint error in domain code.
- ICB presents itself as a bank on every surface. No banner, no watermark, no demo chrome.

## Commands

```bash
pnpm dev                   # all apps + API
pnpm build                 # everything
pnpm lint                  # ESLint with the SonarQube-parity rule set
pnpm typecheck
pnpm test
pnpm verify                # lint + typecheck + test + build

pnpm infra:up / infra:down / infra:reset
pnpm verify:infra          # asserts Mongo transactions work
pnpm seed                  # build a bank
pnpm db:reset              # drop and reseed
pnpm verify:ledger         # assert the six invariants
```

## Layout

```
icb/
├── agent_plan.md              the plan — task cards, ownership map, waves
├── brand/                     logo system, tokens, brand sheet (open preview.html)
├── packages/
│   ├── money/  contracts/  ui/  media/  sdk/  testing/
│   └── config-{ts,eslint,tailwind}/
├── apps/
│   ├── api/                   NestJS + MongoDB
│   ├── marketing/             public site        :3100
│   ├── client/                customer dashboard :3101
│   └── admin/                 operations console :3102
└── tools/scripts/             infra verification, CI helpers
```
