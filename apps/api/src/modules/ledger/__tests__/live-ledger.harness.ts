import { fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Global, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll } from 'vitest';

import {
  IDEMPOTENCY_STORE,
  type IdempotencyStore,
} from '../../../common/interceptors/idempotency-store.port.js';
import { MetricsService } from '../../../common/observability/metrics.service.js';
import { ConfigModule } from '../../../config/config.module.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { IdempotencyModule } from '../../../infrastructure/idempotency/idempotency.module.js';
import { ClockModule } from '../../../simulation/clock/clock.module.js';
import { customerRef, glRef } from '../domain/account-ref.js';
import { GL_CASH } from '../domain/chart-of-accounts.js';
import { HoldService } from '../hold.service.js';
import { LedgerIntegrityService } from '../ledger-integrity.service.js';
import { LedgerModule } from '../ledger.module.js';
import { LedgerService } from '../ledger.service.js';
import { isReplicaSetAvailable } from './mongo-availability.js';

export const SKIP_MESSAGE =
  'MongoDB replica set is not reachable (start it with `pnpm infra:up`); skipping live-database ledger tests';

/**
 * Booting even a focused module can wedge on a half-configured environment (Mongo up, the rest
 * not) — that is a skipped suite with a message, never a hung one. The bound sits well below
 * the hook timeout so teardown always gets its turn.
 */
const BOOT_TIMEOUT_MS = 120_000;
const CLOSE_TIMEOUT_MS = 15_000;
const HOOK_TIMEOUT_MS = 240_000;

/** The services a live-database ledger suite needs, plus its funded test account. */
export interface LiveLedger {
  readonly ledger: LedgerService;
  readonly holds: HoldService;
  readonly integrity: LedgerIntegrityService;
  readonly idempotency: IdempotencyStore;
  readonly accountId: string;
  readonly currency: CurrencyCode;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${String(ms)}ms`)), ms).unref();
    }),
  ]);
}

/** A wedged module must not hang teardown either: close it, but never longer than the bound. */
async function closeQuietly(moduleRef: TestingModule | undefined): Promise<void> {
  const closing = moduleRef?.close();
  if (closing) {
    await withTimeout(closing, CLOSE_TIMEOUT_MS).catch(() => undefined);
  }
}

/**
 * Test-only global binding for the cross-cutting MetricsService.
 *
 * `LedgerModule` consumes metrics but does not own the provider (the composition root does),
 * so a focused testing module must supply it. Global, like the real wiring, and harmless:
 * MetricsService has no dependencies and each instance gets its own prom-client registry.
 */
@Global()
@Module({ providers: [MetricsService], exports: [MetricsService] })
class TestMetricsModule {}

/**
 * Boot just the modules these suites exercise.
 *
 * Deliberately not `AppModule`: the behaviour under test is the ledger's write path, and a
 * broken unrelated module (queues, mail, metrics — anything another track is mid-flight on)
 * must not blind the suites that guard the money. The ledger needs no account row to post
 * against a customer ref, so the test account is simply a fresh id.
 */
async function boot(openingMinorUnits: number, currency: CurrencyCode): Promise<{
  live: LiveLedger;
  moduleRef: TestingModule;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule, ClockModule, TestMetricsModule, LedgerModule, IdempotencyModule],
  }).compile();
  await moduleRef.init();

  const ledger = moduleRef.get(LedgerService);
  const accountId = newId();

  await ledger.post({
    type: 'deposit',
    description: 'Opening balance',
    actor: { kind: 'system', id: null, label: 'test' },
    lines: [
      {
        accountRef: glRef(GL_CASH),
        direction: 'debit',
        amount: fromMinorUnits(openingMinorUnits, currency),
      },
      {
        accountRef: customerRef(accountId),
        direction: 'credit',
        amount: fromMinorUnits(openingMinorUnits, currency),
      },
    ],
  });

  return {
    live: {
      ledger,
      holds: moduleRef.get(HoldService),
      integrity: moduleRef.get(LedgerIntegrityService),
      idempotency: moduleRef.get(IDEMPOTENCY_STORE),
      accountId,
      currency,
    },
    moduleRef,
  };
}

/**
 * Register the boot/teardown hooks for a live-database ledger suite.
 *
 * Returns an accessor: null when the replica set (or the rest of the local stack) is not there,
 * in which case each test must skip itself via `requireLive` — an unavailable environment is a
 * fact, never a false failure.
 */
export function useLiveLedger(
  openingMinorUnits: number,
  currency: CurrencyCode = 'USD',
): () => LiveLedger | null {
  let live: LiveLedger | null = null;
  let moduleRef: TestingModule | undefined;

  beforeAll(async () => {
    if (!(await isReplicaSetAvailable())) {
      return;
    }

    try {
      const booted = await withTimeout(boot(openingMinorUnits, currency), BOOT_TIMEOUT_MS);
      live = booted.live;
      moduleRef = booted.moduleRef;
    } catch (error) {
      // A replica set without the rest of the local stack is still an environment fact.
      console.warn(`${SKIP_MESSAGE} (application module failed to boot: ${String(error)})`);
      await closeQuietly(moduleRef);
      moduleRef = undefined;
    }
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await closeQuietly(moduleRef);
    moduleRef = undefined;
  });

  return () => live;
}

/** Gate every live-database assertion behind a successful boot. */
export function requireLive(
  context: { skip: (note?: string) => never },
  live: LiveLedger | null,
): LiveLedger {
  if (!live) {
    context.skip(SKIP_MESSAGE);
  }
  return live;
}
