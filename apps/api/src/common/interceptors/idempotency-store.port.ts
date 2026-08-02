/** Injection token for the durable idempotency record store (infrastructure layer binds it). */
export const IDEMPOTENCY_STORE = Symbol('ICB_IDEMPOTENCY_STORE');

/** What a replay returns: the original response, byte for byte. */
export interface IdempotencyRecord {
  readonly scope: string;
  readonly key: string;
  readonly statusCode: number;
  readonly body: unknown;
}

/**
 * Port to the `idempotency_records` collection (N6).
 *
 * Defined here in `common` so the interceptor compiles regardless of whether the infrastructure
 * store (BE-03) has landed; whichever side arrives second binds an implementation to
 * `IDEMPOTENCY_STORE`. `save` must be an atomic insert on `(scope, key)` — the store, not the
 * caller, owns timestamps so that record creation follows ClockService (N8).
 */
export interface IdempotencyStore {
  find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}
