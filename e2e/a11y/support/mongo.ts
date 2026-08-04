import { MongoClient } from 'mongodb';

import { MONGO_URI } from './paths';

/** One document id per collection, for resolving admin dynamic-route params. */
export async function withMongo<T>(fn: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close();
  }
}

export async function firstId(
  client: MongoClient,
  collection: string,
  field = '_id',
): Promise<string | null> {
  const doc = await client
    .db('icb')
    .collection(collection)
    .findOne({}, { projection: { [field]: 1 } });
  const value = doc?.[field];
  return typeof value === 'string' ? value : null;
}
