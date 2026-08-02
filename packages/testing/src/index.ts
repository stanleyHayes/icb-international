/**
 * `@icb/testing` — deterministic test infrastructure for every ICB suite.
 *
 * - `createFactoryContext` — seeded clock + faker + ULID generator. Nothing here reads
 *   `Date.now()` or `Math.random()`; same seed, same entities.
 * - Factories — one per domain entity, built from the `@icb/contracts` Zod shapes.
 * - `minimalBank` — a coherent fixture: funded customer + accounts + the posting that funded it.
 * - `createMongoTestHarness` — real-Mongo harness with randomised database names and cleanup.
 * - `mintTestAccessJwt` / `createAuthenticatedAgent` — auth for API integration suites.
 */

export * from './testing.constants.js';
export * from './errors.js';

export * from './core/clock.js';
export * from './core/random.js';
export * from './core/identifiers.js';
export * from './core/context.js';

export * from './factories/helpers.js';
export * from './factories/customer.factory.js';
export * from './factories/account.factory.js';
export * from './factories/ledger.factory.js';
export * from './factories/transaction.factory.js';
export * from './factories/transfer.factory.js';
export * from './factories/card.factory.js';
export * from './factories/loan.factory.js';
export * from './factories/kyc.factory.js';
export * from './factories/staff.factory.js';

export * from './fixtures/bank.fixture.js';

export * from './mongo/mongo-harness.js';

export * from './auth/jwt.js';
export * from './auth/agent.js';
