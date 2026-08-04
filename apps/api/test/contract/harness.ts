import { randomBytes } from 'node:crypto';

import fastifyCookie from '@fastify/cookie';
import { STAFF_ROLES } from '@icb/contracts';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import mongoose, { type Connection } from 'mongoose';
import { ulid } from 'ulid';

import { AppModule } from '../../src/app.module.js';
import { ProblemDetailsFilter } from '../../src/common/filters/problem-details.filter.js';
import { CONFIG, type AppConfiguration } from '../../src/config/configuration.js';
import { TokenService } from '../../src/modules/auth/application/token.service.js';
import { ClockService } from '../../src/simulation/clock/clock.service.js';
import { SeedService } from '../../src/simulation/seed/seed.service.js';

/** Deterministic input to the seeder: same bank shape on every run, ids still fresh. */
const SEED_KEY = 'contract-tests';
/**
 * Months of history each contract boot seeds.
 *
 * These suites assert response *shapes* against the OpenAPI document — they need every collection
 * populated, not a plausible life story. The demo bank's default eighteen months is ~2,700 real
 * ledger postings, and twenty-three suites each boot their own bank: that is what pushed every
 * one of them past the 180s hook budget. Two months still gives each account a closed prior
 * month (statements, arrears ageing) plus the current one.
 */
const CONTRACT_HISTORY_MONTHS = 2;
/** The persona every customer-scoped suite acts as (seed.data.ts). */
const DEMO_EMAIL = 'demo@icb.example';
const MONGO_PROBE_TIMEOUT_MS = 8_000;
const MONGO_PROBE_ATTEMPTS = 3;
const MONGO_PROBE_BACKOFF_MS = 2_000;

export interface ContractApp {
  readonly app: NestFastifyApplication;
  readonly moduleRef: TestingModule;
  /** The live mongoose connection to the throwaway test database. */
  readonly db: Connection;
  /** Database dropped in `close`. */
  readonly dbName: string;
  /**
   * The booted application's own clock — the same instant the seeder wrote history against.
   * Suites derive every "now" from here; a zero-argument `Date` reads the host clock (N8).
   */
  readonly clock: ClockService;
  readonly customerToken: string;
  readonly staffToken: string;
  readonly customerId: string;
  readonly customerEmail: string;
  readonly seedLogins: readonly { email: string; password: string; role: string }[];
}

export type BootResult =
  | { readonly available: true; readonly app: ContractApp }
  | { readonly available: false; readonly reason: string };

/**
 * Boot the real application against a throwaway database on the dev replica set.
 *
 * The composition root is untouched — every module, guard and interceptor runs for real. The
 * only substitutions are environmental: `MONGO_URI` points at a randomised `icb_test_contract_*`
 * database (parallel suites never share state) and background jobs are off so no EOD sweep
 * mutates the bank mid-assertion — the same switch the seed CLI uses.
 *
 * When Mongo is genuinely absent the result is `available: false` and suites skip with the
 * reason; anything that fails after the probe is a real failure and propagates.
 */
export async function bootContractApp(): Promise<BootResult> {
  const baseUri = process.env['MONGO_URI'];
  if (!baseUri) {
    return { available: false, reason: 'MONGO_URI is not set (no .env); cannot boot the API.' };
  }

  const probe = await probeMongo(baseUri);
  if (probe !== null) {
    return { available: false, reason: `MongoDB unreachable: ${probe}` };
  }

  const dbName = `icb_test_contract_${randomBytes(4).toString('hex')}`;
  const uri = retargetDatabase(baseUri, dbName);
  process.env['MONGO_URI'] = uri;
  process.env['BACKGROUND_JOBS_ENABLED'] = 'false';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = await startApp(moduleRef);

  const seedLogins = await seedBank(moduleRef);
  const db = moduleRef.get<Connection>(getConnectionToken());
  const { customerId, customerToken, staffToken } = await resolvePrincipals(moduleRef, db);

  return {
    available: true,
    app: {
      app,
      moduleRef,
      db,
      dbName,
      clock: moduleRef.get(ClockService),
      customerToken,
      staffToken,
      customerId,
      customerEmail: DEMO_EMAIL,
      seedLogins,
    },
  };
}

/**
 * Build and start the HTTP application, mirroring main.ts: cookie signing (auth writes the
 * refresh-token cookie), one prefix, the RFC 9457 filter, no versioning on top.
 */
async function startApp(moduleRef: TestingModule): Promise<NestFastifyApplication> {
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );
  const config = moduleRef.get<AppConfiguration>(CONFIG);
  await app
    .getHttpAdapter()
    .getInstance()
    .register(fastifyCookie, { secret: config.crypto.cookieSecret });
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

interface Principals {
  readonly customerId: string;
  readonly customerToken: string;
  readonly staffToken: string;
}

/** The customer and staff principals every suite acts as, minted against the seeded bank. */
async function resolvePrincipals(moduleRef: TestingModule, db: Connection): Promise<Principals> {
  const customer = await db
    .collection<{ _id: string }>('customers')
    .findOne({ email: DEMO_EMAIL });
  if (!customer) {
    throw new Error(`Seed completed but ${DEMO_EMAIL} is missing — the seed contract changed.`);
  }
  // Auth endpoints resolve the caller via `sub` against user_credentials, so the token's
  // subject must be the credential id, not the customer id.
  const credential = await db
    .collection<{ _id: string }>('user_credentials')
    .findOne({ email: DEMO_EMAIL });
  if (!credential) {
    throw new Error(`Seed completed but the ${DEMO_EMAIL} credential is missing.`);
  }

  const tokens = moduleRef.get(TokenService);
  const customerToken = await mint(tokens, {
    sub: credential._id,
    customerId: customer._id,
    email: DEMO_EMAIL,
    roles: [],
  });
  // Staff suites exercise back-office endpoints; the union of roles keeps the suite focused on
  // contract shape, while SEC-02 owns proving each role boundary denies correctly. `sub` is a
  // ULID because some handlers persist it into ULID-validated fields (e.g. note author ids).
  const staffToken = await mint(tokens, {
    sub: ulid(),
    customerId: null,
    email: 'ops@icb.example',
    roles: [...STAFF_ROLES],
  });

  return { customerId: customer._id, customerToken, staffToken };
}

/** Drop the throwaway database and shut the application down. Safe to call after a failed boot. */
export async function closeContractApp(app: ContractApp | undefined): Promise<void> {
  if (!app) return;
  await app.db.dropDatabase();
  await app.app.close();
}

async function mint(
  tokens: TokenService,
  claims: { sub: string; customerId: string | null; email: string; roles: string[] },
): Promise<string> {
  const { token } = await tokens.issueAccessToken({ ...claims, sessionId: `session-${claims.sub}` });
  return token;
}

async function seedBank(
  moduleRef: TestingModule,
): Promise<ContractApp['seedLogins']> {
  const seeder = moduleRef.get(SeedService);
  const result = await seeder.run({
    reset: false,
    seed: SEED_KEY,
    historyMonths: CONTRACT_HISTORY_MONTHS,
  });
  return result.logins;
}

async function probeMongo(uri: string): Promise<string | null> {
  // Retry through transient refusals: the dev Mongo sits behind Docker's userland proxy, and a
  // sibling suite's seed can briefly saturate it. One 5s attempt mistook that for absence and
  // whole suites skipped vacuously; three spaced attempts make "unavailable" mean unavailable.
  let lastReason = 'probe did not run';
  for (let attempt = 0; attempt < MONGO_PROBE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, MONGO_PROBE_BACKOFF_MS));
    }
    const probe = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: MONGO_PROBE_TIMEOUT_MS,
    });
    try {
      await probe.asPromise();
      return null;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    } finally {
      await probe.close().catch(() => undefined);
    }
  }
  return lastReason;
}

/** Rewrite the database segment of a Mongo URI, preserving credentials and replica-set params. */
function retargetDatabase(baseUri: string, dbName: string): string {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  // Every suite boots a full app, and mongoose defaults to a 100-socket pool per boot; a few
  // suites in parallel is hundreds of sockets through the Docker port-forward, which drops
  // connections under that pressure (MongoPoolClearedError mid-seed). Contract traffic is
  // sequential request/response — ten sockets per suite is generous.
  url.searchParams.set('maxPoolSize', '10');
  return url.toString();
}
