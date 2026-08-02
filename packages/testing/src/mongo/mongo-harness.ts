import { MongoClient } from 'mongodb';

import { MongoUriMissingError } from '../errors.js';
import { createPrng } from '../core/random.js';
import {
  CROCKFORD_ALPHABET,
  DEFAULT_SEED,
  MONGO_SELECTION_TIMEOUT_MS,
  TEST_DB_NAME_PREFIX,
  TEST_DB_SUFFIX_LENGTH,
} from '../testing.constants.js';

/**
 * Mongo test harness.
 *
 * `mongodb-memory-server` is deliberately NOT used: it is not in the workspace dependency tree,
 * and the project already runs a replica set (`docker compose up mongo`, MONGO_URI) that
 * integration tests must match — in-memory single-node Mongo cannot run the multi-document
 * transactions the ledger relies on.
 *
 * Instead the harness boots against the env connection string with a randomised database name
 * (`icb_test_<suffix>`), so parallel suites never see each other's data, and drops that
 * database on cleanup. Pass a distinct `seed` (or `dbNameSuffix`) per parallel suite.
 */

export interface MongoHarnessOptions {
  /** Connection string. Defaults to `MONGO_URI`, then `MONGODB_URI`, from `env`. */
  readonly uri?: string;
  /** Environment to read the connection string from. Defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Seed for the randomised database name. Distinct per parallel suite. */
  readonly seed?: number;
  /** Pin the database name suffix instead of deriving it from the seed. */
  readonly dbNameSuffix?: string;
}

export interface MongoTestHarness {
  /** Full connection string pointing at the randomised test database. */
  readonly uri: string;
  readonly dbName: string;
  readonly client: MongoClient;
  /** Drop the test database. Idempotent. */
  drop(): Promise<void>;
  /** Drop the test database and close the connection. Call in `afterAll`. */
  close(): Promise<void>;
}

export async function createMongoTestHarness(
  options: MongoHarnessOptions = {},
): Promise<MongoTestHarness> {
  const baseUri = options.uri ?? readEnvUri(options.env ?? process.env);
  if (baseUri == null) {
    throw new MongoUriMissingError();
  }
  const dbName = `${TEST_DB_NAME_PREFIX}_${options.dbNameSuffix ?? randomSuffix(options.seed)}`;
  const client = new MongoClient(baseUri, { serverSelectionTimeoutMS: MONGO_SELECTION_TIMEOUT_MS });
  await client.connect();
  return {
    uri: testDatabaseUri(baseUri, dbName),
    dbName,
    client,
    async drop() {
      await client.db(dbName).dropDatabase();
    },
    async close() {
      await client.db(dbName).dropDatabase();
      await client.close();
    },
  };
}

/**
 * Rewrite a Mongo connection string to point at `dbName`, preserving host, credentials, and
 * query string (the replica-set parameters must survive or transactions break).
 */
export function testDatabaseUri(baseUri: string, dbName: string): string {
  const url = new URL(baseUri);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function readEnvUri(env: NodeJS.ProcessEnv): string | undefined {
  return env['MONGO_URI'] ?? env['MONGODB_URI'];
}

/** Seeded Crockford suffix — deterministic per seed, unique per suite that picks a seed. */
function randomSuffix(seed: number | undefined): string {
  const random = createPrng(seed ?? DEFAULT_SEED);
  let suffix = '';
  for (let index = 0; index < TEST_DB_SUFFIX_LENGTH; index += 1) {
    suffix += CROCKFORD_ALPHABET[Math.floor(random() * CROCKFORD_ALPHABET.length)] ?? '0';
  }
  return suffix.toLowerCase();
}
