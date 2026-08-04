import { MongoClient } from 'mongodb';

import { env } from './env';

/**
 * Direct database access, used for exactly one thing: completing the email-verification loop.
 *
 * Registration e-mails a single-use token that is stored only as a hash and delivered via the
 * recording (in-memory) transport — by design nothing readable leaves the API process. A real
 * deployment would use a mailhog-style capture; here the equivalent is flipping `emailVerified`
 * on the credential row the API itself wrote. Nothing else may be written through this helper:
 * money, ledger and KYC state changes must go through the API or they bypass the invariants
 * this suite exists to prove.
 */

export async function withMongo<T>(fn: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close();
  }
}

export async function mongoReachable(): Promise<boolean> {
  try {
    return await withMongo(async (client) => {
      await client.db().admin().ping();
      return true;
    });
  } catch {
    return false;
  }
}

export async function markEmailVerified(email: string): Promise<void> {
  await withMongo(async (client) => {
    const result = await client
      .db()
      .collection('user_credentials')
      .updateOne(
        { email },
        { $set: { emailVerified: true, emailVerificationTokenHash: null } },
      );
    if (result.matchedCount !== 1) {
      throw new Error(`no credential row found for ${email} — did registration persist?`);
    }
  });
}
