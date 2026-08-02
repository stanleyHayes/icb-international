import { DUPLICATE_KEY_CODE } from './database.constants.js';

/**
 * True when Mongo rejected a write because a unique index already holds the key.
 *
 * The driver reports this as a `MongoServerError` with `code: 11000`; matching on the code
 * rather than the class keeps this usable with mocked errors in tests.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_CODE
  );
}
