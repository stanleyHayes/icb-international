import mongoose from 'mongoose';

/**
 * Fail fast when probing: a missing local replica set must cost a skip message, not a hung suite.
 * Deliberately shorter than the application's own selection timeout.
 */
const PROBE_TIMEOUT_MS = 2_000;

/**
 * Is the MongoDB replica set the integration tests need actually there?
 *
 * The ledger's guarantees rest on multi-document transactions, which a standalone mongod cannot
 * run — so a bare `ping` is not enough; the server must report a replica-set name. When it does
 * not, specs skip with a message rather than fail: an absent Docker daemon is an environment
 * fact, not a regression.
 */
export async function isReplicaSetAvailable(): Promise<boolean> {
  const uri = process.env['MONGO_URI'] ?? process.env['MONGODB_URI'];
  if (!uri) {
    return false;
  }

  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: PROBE_TIMEOUT_MS,
  });

  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) {
      return false;
    }
    const hello = await db.admin().command({ hello: 1 });
    return typeof hello['setName'] === 'string';
  } catch {
    return false;
  } finally {
    await connection.close().catch(() => undefined);
  }
}
