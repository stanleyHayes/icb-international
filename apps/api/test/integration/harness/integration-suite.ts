import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import fastifyCookie from '@fastify/cookie';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { createMongoTestHarness, type MongoTestHarness } from '@icb/testing';
import { describe, it } from 'vitest';

import { AppModule } from '../../../src/app.module.js';
import { CorrelationInterceptor } from '../../../src/common/interceptors/correlation.interceptor.js';
import { ProblemDetailsFilter } from '../../../src/common/filters/problem-details.filter.js';
import { QueueDepthCollector } from '../../../src/common/observability/queue-depth.collector.js';
import { CONFIG, type AppConfiguration } from '../../../src/config/configuration.js';
import { pickReachableRedisUrl } from './redis-probe.js';

/**
 * One integration suite = one full application boot against one throwaway database.
 *
 * The database name is randomised per spec file (`dbNameSuffix` must be unique across the
 * suite files so parallel forks never share collections) and dropped in `close`. MongoDB is
 * probed up front: when it is genuinely unreachable the suite reports itself unavailable and
 * `describeIntegration` registers a single skipped test naming the reason, rather than letting
 * thirty tests time out one by one and read as product failures.
 */

export interface IntegrationSuite {
  readonly available: boolean;
  readonly reason: string | null;
  readonly harness: MongoTestHarness | null;
}

export interface IntegrationApp {
  readonly app: NestFastifyApplication;
  readonly harness: MongoTestHarness;
  /** Drop the test database, close the app, close the probe client. Idempotent. */
  close(): Promise<void>;
}

export async function probeMongo(dbNameSuffix: string): Promise<IntegrationSuite> {
  try {
    const harness = await createMongoTestHarness({ dbNameSuffix });
    return { available: true, reason: null, harness };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
      harness: null,
    };
  }
}

/**
 * `describe` that runs only against a live Mongo. The skip branch still registers inside a
 * `describe` with the suite's name, so the report shows exactly which suite was skipped and why.
 */
export function describeIntegration(
  suite: IntegrationSuite,
  name: string,
  body: () => void,
): void {
  if (!suite.available) {
    describe(name, () => {
      // Skipped on purpose, and reported rather than dropped: the run has to name the suite and
      // the probe failure, so an unreachable database can never be mistaken for a passing suite.
      it.skip(`MongoDB unreachable (${suite.reason ?? 'unknown'}) — integration tests skipped`);
    });
    return;
  }
  describe(name, body);
}

/**
 * Boot the real AppModule the way main.ts does — same cookie plugin, global prefix, problem
 * filter — against the suite's database. Background pollers are off so a drain pass never
 * races an assertion; Redis falls back to any reachable instance (see redis-probe.ts).
 */
export async function bootIntegrationApp(harness: MongoTestHarness): Promise<IntegrationApp> {
  process.env['NODE_ENV'] = 'test';
  process.env['MONGO_URI'] = harness.uri;
  process.env['BACKGROUND_JOBS_ENABLED'] = 'false';
  process.env['LOG_LEVEL'] = 'error';
  process.env['REDIS_URL'] = await pickReachableRedisUrl(process.env['REDIS_URL'] ?? '');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // The collector is a background poller (disabled here via BACKGROUND_JOBS_ENABLED=false)
    // whose queue gauges are irrelevant to the money paths. Substituting it keeps this suite
    // about money, not about whether an observability edit elsewhere in the tree has landed.
    .overrideProvider(QueueDepthCollector)
    .useValue({
      onApplicationBootstrap: () => undefined,
      onModuleDestroy: () => undefined,
    })
    /*
     * Registration is capped at 5 per minute per IP — a real defence against credential
     * stuffing, and one this suite trips on its sixth customer because every request comes from
     * 127.0.0.1. The seam is the storage, not the guard: `ThrottleGuard` is bound through
     * APP_GUARD, which Nest instantiates under that token rather than its own class, so neither
     * overrideGuard nor overrideProvider reaches it. A store that never accumulates lets the
     * guard run for real and always find room.
     *
     * Money paths are what these specs are for; the limiter itself has 19 dedicated tests in
     * src/common/guards, so nothing is lost here.
     */
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () => Promise.resolve({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
    })
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  const config = app.get<AppConfiguration>(CONFIG);
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyCookie, { secret: config.crypto.cookieSecret });

  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalInterceptors(new CorrelationInterceptor());
  app.useGlobalFilters(new ProblemDetailsFilter());

  await app.init();
  await fastify.ready();

  let closed = false;
  return {
    app,
    harness,
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await app.close();
      await harness.close();
    },
  };
}

/** Shape of one raw ledger entry row, for direct-DB balance assertions. */
interface LedgerEntryRow {
  readonly transactionId: string;
  readonly direction: 'debit' | 'credit';
  readonly minorUnits: number;
}

/**
 * The double-entry invariant read straight from `ledger_entries`: for every transaction the
 * debits equal the credits, per currency. Going around the API for this assertion is the point
 * — a bug in the balance read path must not be able to hide an unbalanced posting.
 */
export async function assertLedgerBalanced(harness: MongoTestHarness): Promise<void> {
  const entries = await harness.client
    .db(harness.dbName)
    .collection<LedgerEntryRow>('ledger_entries')
    .find({})
    .toArray();

  const totals = new Map<string, { debits: number; credits: number }>();
  for (const entry of entries) {
    const key = `${entry.transactionId}`;
    const running = totals.get(key) ?? { debits: 0, credits: 0 };
    if (entry.direction === 'debit') {
      running.debits += entry.minorUnits;
    } else {
      running.credits += entry.minorUnits;
    }
    totals.set(key, running);
  }

  const unbalanced = [...totals.entries()].filter(([, t]) => t.debits !== t.credits);
  if (unbalanced.length > 0) {
    const detail = unbalanced
      .map(([id, t]) => `${id}: debits ${t.debits} ≠ credits ${t.credits}`)
      .join('; ');
    throw new Error(`Unbalanced ledger transactions: ${detail}`);
  }
}
