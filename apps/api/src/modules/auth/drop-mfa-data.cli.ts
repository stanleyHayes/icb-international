import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

// A CLI lives for one job. Periodic sweeps would fire mid-run and then race the shutdown that
// follows, so they stay off for the duration.
process.env['BACKGROUND_JOBS_ENABLED'] = 'false';

import { AppModule } from '../../app.module.js';
import { isDomainError } from '../../common/errors/index.js';

/** Whole collections that only ever held MFA state. */
const DROPPED_COLLECTIONS = ['mfa_challenges', 'trusted_devices'] as const;

/** MFA fields carved out of the collections that remain. */
const FIELD_CLEANUPS = [
  {
    collection: 'user_credentials',
    fields: ['mfaEnabled', 'mfaSecretEncrypted', 'recoveryCodeHashes'],
  },
  { collection: 'staff_users', fields: ['mfaRequired', 'mfaEnabled'] },
] as const;

/**
 * One-off data cleanup for the MFA removal.
 *
 * Drops the two collections that only existed for challenges and trusted devices, and unsets the
 * MFA fields on the credential and staff documents that stay behind. Idempotent on purpose: a
 * second run finds no collections to drop (namespace-not-found is swallowed) and no fields left
 * to unset, so it is safe to re-point at an environment after a partial first run.
 *
 * Run it after the MFA-free build is deployed — never before, or the old code would recreate the
 * collections on its next write.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const db = connection.db;
    if (!db) {
      throw new Error('The Mongoose connection has no database handle');
    }

    process.stdout.write('\nDropping MFA data…\n\n');

    for (const name of DROPPED_COLLECTIONS) {
      const dropped = await dropIfPresent(db, name);
      process.stdout.write(`  ${name.padEnd(20)} ${dropped ? 'dropped' : 'absent (skipped)'}\n`);
    }

    for (const { collection, fields } of FIELD_CLEANUPS) {
      const unset = Object.fromEntries(fields.map((field) => [field, '']));
      const result = await db.collection(collection).updateMany({}, { $unset: unset });
      process.stdout.write(
        `  ${collection.padEnd(20)} ${fields.join(', ')} unset on ${result.modifiedCount} of ${result.matchedCount} docs\n`,
      );
    }

    process.stdout.write('\n  Done. Safe to re-run; a second pass changes nothing.\n\n');
  } finally {
    await app.close();
  }
}

/** Dropping a collection that is already gone is success, not an error. */
async function dropIfPresent(db: NonNullable<Connection['db']>, name: string): Promise<boolean> {
  try {
    await db.dropCollection(name);
    return true;
  } catch (error) {
    if (isNamespaceNotFound(error)) {
      return false;
    }
    throw error;
  }
}

function isNamespaceNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 26 || (typeof message === 'string' && message.includes('ns not found'));
}

/**
 * A refusal the operator can act on gets the sentence; anything unexpected gets the stack,
 * because that is the case where the trace is the only thing that helps.
 */
function describe(error: unknown): string {
  if (isDomainError(error)) {
    return error.message;
  }
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`\nMFA data cleanup failed: ${describe(error)}\n\n`);
  process.exit(1);
});
