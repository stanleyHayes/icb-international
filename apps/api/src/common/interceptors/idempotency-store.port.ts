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
 * The result of atomically claiming `(scope, key)`.
 *
 * - `claimed` — the caller won the insert race and must execute the handler, then `save`.
 * - `completed` — a stored response already exists; replay it without re-running the handler.
 * - `pending` — another request holds the claim and is still executing; the caller's policy
 *   (wait-and-replay, fail fast) is the interceptor's to make, not the store's.
 */
export type IdempotencyClaim =
  | { readonly outcome: 'claimed' }
  | { readonly outcome: 'completed'; readonly record: IdempotencyRecord }
  | { readonly outcome: 'pending' };

/**
 * Port to the `idempotency_records` collection (N6).
 *
 * Defined here in `common` so the interceptor compiles regardless of whether the infrastructure
 * store (BE-03) has landed; whichever side arrives second binds an implementation to
 * `IDEMPOTENCY_STORE`. The store, not the caller, owns timestamps so that record creation
 * follows ClockService (N8).
 *
 * The protocol is claim → execute → save, all behind the unique `(scope, key)` index:
 *
 * - `claim` inserts a pending marker atomically, so two concurrent same-key requests can never
 *   both execute — the loser is told the key is `pending` (or already `completed`).
 * - `save` completes the caller's pending claim, or — for callers that never claimed — inserts
 *   the record first-write-wins, exactly as before the claim protocol existed.
 * - `release` drops an un-completed claim after a failed execution, so a retry gets a fresh run
 *   instead of being locked out by a corpse.
 * - `find` answers only with a completed, replayable record; a pending claim reads as absent.
 */
export interface IdempotencyStore {
  find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  claim(scope: string, key: string): Promise<IdempotencyClaim>;
  save(record: IdempotencyRecord): Promise<void>;
  release(scope: string, key: string): Promise<void>;
}
