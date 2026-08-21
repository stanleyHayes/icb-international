#!/usr/bin/env node
/**
 * Asserts the local stack can do what the ledger requires: multi-document transactions on
 * MongoDB. Fails loudly rather than letting the API start into a half-working database.
 */
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27217/icb?directConnection=true';

async function verifyMongo() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await client.db().collection('__infra_probe').insertOne({ at: new Date() }, { session });
    });
    await client.db().collection('__infra_probe').drop();
    return 'transactions available';
  } finally {
    await session.endSession();
    await client.close();
  }
}

const checks = [['MongoDB', verifyMongo]];

let failed = false;
for (const [name, check] of checks) {
  try {
    const detail = await check();
    console.log(`  ✓ ${name.padEnd(9)} ${detail}`);
  } catch (error) {
    failed = true;
    console.error(`  ✗ ${name.padEnd(9)} ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) {
  console.error('\nInfrastructure is not ready. Run `pnpm infra:up` and try again.');
  process.exit(1);
}
console.log('\nInfrastructure ready.');
