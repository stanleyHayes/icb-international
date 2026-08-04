import { getConnectionToken } from '@nestjs/mongoose';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import fastifyCookie from '@fastify/cookie';
import { createMongoTestHarness, type MongoTestHarness } from '@icb/testing';
import mongoose from 'mongoose';

import { AppModule } from '../../../src/app.module.js';
import { ProblemDetailsFilter } from '../../../src/common/filters/problem-details.filter.js';
import { CorrelationInterceptor } from '../../../src/common/interceptors/correlation.interceptor.js';
import { newId } from '../../../src/infrastructure/database/identifier.js';
import { isReplicaSetAvailable } from '../../../src/modules/ledger/__tests__/mongo-availability.js';

/** Boot/teardown bounds so a wedged environment costs a skip, never a hung suite. */
const BOOT_TIMEOUT_MS = 240_000;
const CLOSE_TIMEOUT_MS = 20_000;

export const SKIP_MESSAGE =
  'MongoDB replica set is not reachable (start it with `pnpm infra:up`); skipping SEC-02 live-database tests';

/** Wire contract from `main.ts` that a test-booted app must reproduce by hand. */
const TEST_COOKIE_SECRET = 'sec02-test-cookie-secret-not-a-real-secret';

export interface SecurityTestApp {
  readonly app: NestFastifyApplication;
  readonly connection: mongoose.Connection;
  readonly mongo: MongoTestHarness;
  close(): Promise<void>;
}

/**
 * Boot the real AppModule against a randomised database on the local replica set.
 *
 * Returns `null` when the replica set is absent or the module cannot boot — callers turn that
 * into a skip-with-message, never a false failure (agent_plan.md §10).
 */
export async function bootSecurityApp(purpose: string): Promise<SecurityTestApp | null> {
  if (!(await isReplicaSetAvailable())) {
    return null;
  }
  // Unique database per run: a crashed predecessor must never poison this one with leftovers.
  const dbNameSuffix = `${purpose}${newId().toLowerCase().slice(-6)}`;
  let handle: SecurityTestApp | null = null;
  try {
    handle = await withTimeout(boot(dbNameSuffix), BOOT_TIMEOUT_MS);
    return handle;
  } catch (error) {
    console.warn(`${SKIP_MESSAGE} (application failed to boot: ${String(error)})`);
    await handle?.close();
    return null;
  }
}

async function boot(dbNameSuffix: string): Promise<SecurityTestApp> {
  const mongo = await createMongoTestHarness({ dbNameSuffix });
  try {
    return await bootOnHarness(mongo);
  } catch (error) {
    // A half-booted database must not survive: the next run shares this replica set.
    await mongo.close().catch(() => undefined);
    throw error;
  }
}

async function bootOnHarness(mongo: MongoTestHarness): Promise<SecurityTestApp> {
  const connection = mongoose.createConnection(mongo.uri, {
    retryWrites: false,
    writeConcern: { w: 'majority' },
    readPreference: 'primary',
  });
  await connection.asPromise();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getConnectionToken())
    .useValue(connection)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: true }), // Mirrors main.ts; lets suites vary client IP.
  );
  await app.getHttpAdapter().getInstance().register(fastifyCookie, { secret: TEST_COOKIE_SECRET });
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalInterceptors(new CorrelationInterceptor());
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  let closed = false;
  return {
    app,
    connection,
    mongo,
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await withTimeout(app.close(), CLOSE_TIMEOUT_MS).catch(() => undefined);
      await connection.close().catch(() => undefined);
      await mongo.close().catch(() => undefined);
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    }),
  ]);
}
