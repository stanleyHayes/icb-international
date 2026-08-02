# ICB — International Commercial Bank

A full-fidelity simulation of a commercial bank: marketing site, customer dashboard,
operations console, and a NestJS + MongoDB core built on a real double-entry ledger.

**No real money moves.** No payment network, card scheme, or banking rail is ever contacted —
those are simulated adapters with realistic latency, cut-offs, and failure codes. Everything
else behaves exactly as a bank does. See [`agent_plan.md`](agent_plan.md) for the full
architecture and the task breakdown any agent can pick work from.

---

## Quickstart

```bash
# 0. Prerequisites: Node 22+, pnpm 10+, Docker
pnpm install
cp .env.example .env

# 1. Infrastructure — MongoDB 8 as a replica set (transactions are mandatory) + Redis 8
pnpm infra:up
pnpm verify:infra          # asserts multi-document transactions actually work

# 2. Build the API, then seed a whole bank with 18 months of history
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
| `root@icb.example` | `Staff!2345678` | Super admin |

Staff sign in at the **operations console** (3102), customers at the **dashboard** (3101).

---

## What is actually built

**The ledger is real.** Not a balance column — a double-entry ledger with immutable postings,
atomic multi-document transactions, and six invariants asserted on demand:

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

  2,715 transactions · 5,430 entries · BALANCED
```

| Layer | Status |
| --- | --- |
| `@icb/money` | Integer minor units, 15 currencies with correct scales, largest-remainder allocation, FX with explicit rounding delta. **53 tests, 98% coverage.** |
| `@icb/contracts` | Zod schemas + inferred types for every bounded context. One source of truth for API and apps. |
| `@icb/ui` | Design system bound to `brand/tokens` — one token change reaches all three apps. |
| API — core | Typed config validated at boot, RFC 9457 problem details, `TransactionManager` with write-conflict retry, injected `ClockService` (time travel), global auth guard. |
| API — ledger | Balanced posting, immutable entries, reversal-by-mirror, holds, trial balance, integrity checks. |
| API — domain | Auth (argon2id, rotating refresh with reuse detection), accounts (MOD-97 IBANs, Luhn account numbers), transactions, transfers, admin aggregation. |
| Simulation | Controllable clock with a business calendar, deterministic seeded generation. |
| Marketing | Home, header/footer, live rate strip, honest product preview. |
| Dashboard | Login, overview, accounts, transactions, transfers — all server-rendered against the live API. |
| Console | Operations KPIs, ledger integrity, trial balance, transaction monitor. |

### Not yet built

The plan specifies far more than one pass could deliver. These have contracts and task cards in
[`agent_plan.md`](agent_plan.md) but no implementation yet: **cards, loans, savings goals and
term deposits, bill pay, KYC workflow, disputes, fraud/AML engines, notifications (Resend),
document storage (Cloudinary), statements, MFA and step-up, and the remaining marketing and
console screens.** Each is an independently claimable card.

---

## Architecture in one paragraph

pnpm workspaces + Turborepo. `@icb/contracts` is the contract; the API and all three apps derive
their types from it, which is what lets separate agents work in parallel without drift. The API
is NestJS on Fastify with one module per bounded context and a strict layering of
controller → use case → domain → repository. MongoDB runs as a replica set because the ledger
needs multi-document ACID transactions. The customer dashboard and console are Next.js App Router
apps that call the API **only from the server** — the access token lives in an AES-256-GCM sealed
cookie and never enters the browser. Decisions of record are in
[`agent_plan.md` §2](agent_plan.md#2-architecture).

## Non-negotiables

Encoded in lint and CI, not just prose — see [`agent_plan.md` §1](agent_plan.md#1-non-negotiables).

- Money is an **integer** in minor units. Never a float.
- **Double entry or it didn't happen.** No code outside `LedgerService` writes a balance.
- Postings are **immutable**. Corrections are reversing transactions.
- Time comes from `ClockService`. `new Date()` is banned by lint in domain code.
- The product **presents as a real bank** — no simulation banner. The boundary is enforced in the
  backend and surfaced only via the `X-ICB-Environment` header.

## Commands

```bash
pnpm dev                   # all apps + API
pnpm build                 # everything
pnpm lint                  # ESLint with the SonarQube-parity rule set
pnpm typecheck
pnpm test                  # unit + property tests
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
│   ├── money/                 monetary primitives
│   ├── contracts/             Zod schemas — the contract
│   ├── ui/                    design system
│   └── config-{ts,eslint}/    shared configuration
├── apps/
│   ├── api/                   NestJS + MongoDB
│   ├── marketing/             public site        :3100
│   ├── client/                customer dashboard :3101
│   └── admin/                 operations console :3102
└── tools/scripts/             infra verification, replica-set init
```

---

*ICB is a simulation. No real money moves, no real rail is contacted, no real customer exists.*
