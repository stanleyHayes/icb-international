# @icb/testing

Deterministic test infrastructure for every ICB suite (unit, integration, contract, E2E).
Owner: **QA-01**.

## Principles

- **Nothing reads the host clock or `Math.random()`.** Every factory takes a `FactoryContext`
  (`createFactoryContext({ seed })`) that carries a `TestClock`, a seeded faker, and a seeded
  ULID generator. Same seed → byte-identical entities, on every machine.
- **Shapes come from `@icb/contracts`.** Factories return the contract's inferred types; the
  package's own tests parse every factory output through its Zod schema to catch drift.
- **The ledger stays balanced.** `ledgerTransaction` validates Σ debits = Σ credits per currency
  and throws `UnbalancedPostingError` rather than seed a corrupt ledger (agent_plan.md N4).

## Usage

```ts
import { createFactoryContext, customerProfile, minimalBank } from '@icb/testing';

const ctx = createFactoryContext({ seed: 42 });
const customer = customerProfile(ctx, { status: 'suspended' });

// A coherent mini-bank: customer + funded current account + empty savings + the posted deposit.
const bank = minimalBank({ seed: 42 });
```

### Factories

`customerProfile` · `accountDetail` / `accountSummary` / `savingsAccount` · `ledgerTransaction`
(+ `TestLedgerTransaction` / `TestLedgerEntry`, plain mirrors of the API's Mongoose schemas) ·
`transactionSummary` / `transactionDetail` · `transferDetail` · `cardDetail` · `loan` /
`repaymentInstalment` · `kycCase` · `staffUser` / `adminUser`. All take `(ctx, overrides)` with
shallow-merged overrides.

## Mongo test harness

`mongodb-memory-server` is deliberately **not** used: it is not in the workspace, and ICB's
ledger depends on multi-document transactions, which require a **replica set** — an in-memory
single node cannot run them. The harness boots against the real dev replica set instead:

```ts
import { createMongoTestHarness } from '@icb/testing';

const harness = await createMongoTestHarness({ seed: 7001 }); // reads MONGO_URI / MONGODB_URI
// harness.uri  → mongodb://…/icb_test_<suffix>?replicaSet=icb-rs&…  (randomised db name)
// …boot the Nest app against harness.uri, run the suite…
await harness.close(); // drops icb_test_<suffix> and disconnects
```

- Database names are randomised per seed (`icb_test_<8 chars>`), so parallel suites never share
  data. **Pass a distinct `seed` (or `dbNameSuffix`) per parallel suite.**
- Requires the dev replica set: `pnpm infra:up` (docker-compose `mongo`, `MONGO_URI`).
- Throws `MongoUriMissingError` when no connection string is available.

## Auth helpers

```ts
import { createAuthenticatedAgent, mintTestAccessJwt } from '@icb/testing';

const token = mintTestAccessJwt({ secret: process.env.JWT_ACCESS_SECRET!, clock });
const agent = createAuthenticatedAgent({ app, token, idempotencyKey: '…' });
await agent.post('/v1/transfers').send(payload).expect(201);
```

`mintTestAccessJwt` mirrors the API's `TokenService` claims (`sub`, `customerId`, `email`,
`roles`, `sessionId`, `typ: 'access'`), issuer `icb`, audience `icb-clients`, HS256. Pass a
`TestClock` to pin `iat` for deterministic, time-travel-safe tokens. The agent adds the bearer
token to every request and `Idempotency-Key` to mutations (N6).

## Scripts

`pnpm --filter @icb/testing typecheck|lint|test|build`
