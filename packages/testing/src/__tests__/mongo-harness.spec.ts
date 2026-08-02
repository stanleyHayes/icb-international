import { describe, expect, it } from 'vitest';

import { MongoUriMissingError } from '../errors.js';
import { createMongoTestHarness, testDatabaseUri } from '../mongo/mongo-harness.js';

const BASE_URI = 'mongodb://localhost:27217/icb?replicaSet=icb-rs&directConnection=true';

describe('testDatabaseUri', () => {
  it('swaps the database and preserves replica-set parameters', () => {
    expect(testDatabaseUri(BASE_URI, 'icb_test_abc')).toBe(
      'mongodb://localhost:27217/icb_test_abc?replicaSet=icb-rs&directConnection=true',
    );
  });

  it('handles a connection string without a database segment', () => {
    expect(testDatabaseUri('mongodb://localhost:27017', 'icb_test_x')).toBe(
      'mongodb://localhost:27017/icb_test_x',
    );
  });
});

describe('createMongoTestHarness', () => {
  it('fails fast with a typed error when no connection string exists', async () => {
    await expect(createMongoTestHarness({ env: {} })).rejects.toThrow(MongoUriMissingError);
  });

  it('prefers an explicit uri over the environment', async () => {
    // Unreachable host: a failure proves it attempted *this* uri, not a missing-env error.
    const unreachable = 'mongodb://127.0.0.1:1/icb';
    await expect(createMongoTestHarness({ uri: unreachable, env: {} })).rejects.not.toThrow(
      MongoUriMissingError,
    );
  }, 15_000);
});
