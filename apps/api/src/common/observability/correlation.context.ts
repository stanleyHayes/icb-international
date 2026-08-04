import { AsyncLocalStorage } from 'node:async_hooks';

interface CorrelationStore {
  readonly correlationId: string;
}

/**
 * Correlation context outside the request cycle.
 *
 * The correlation id starts on an HTTP header, but the work it triggers does not stay on the
 * request: a transfer publishes an outbox event inside its transaction, a drain delivers it
 * minutes later, a queue job retries it tomorrow. AsyncLocalStorage lets each of those hops
 * recover the id without threading it through every signature on the way.
 *
 * Two entry styles, deliberately:
 *
 *  - `enterWithCorrelation` for the HTTP edge, where an interceptor cannot wrap the code that
 *    runs after it (Nest subscribes to the interceptor's observable *after* `intercept`
 *    returns, so a `run` there would end before the handler executes). `enterWith` binds the
 *    store to the request's async resource instead, which lives exactly as long as the request.
 *  - `runWithCorrelation` for drains and job processors, where the caller owns the async
 *    boundary and `run` is the honest tool.
 */
const storage = new AsyncLocalStorage<CorrelationStore>();

/** Bind a correlation id to the current async resource — the request-scoped form. */
export function enterWithCorrelation(correlationId: string): void {
  storage.enterWith({ correlationId });
}

/** Run `work` with a correlation id in scope — the owned-async-boundary form. */
export function runWithCorrelation<T>(correlationId: string, work: () => T): T {
  return storage.run({ correlationId }, work);
}

/** The id in scope, or null when there is none (boot code, tests, a forgotten hop). */
export function currentCorrelationId(): string | null {
  return storage.getStore()?.correlationId ?? null;
}
