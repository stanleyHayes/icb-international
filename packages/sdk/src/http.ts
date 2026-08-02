/** HTTP vocabulary shared by the endpoint definitions, the transport, and the mock. */

export const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Per-call options. `signal` is passed straight through to `fetch`. */
export interface RequestOptions {
  signal?: AbortSignal;
  /** Overrides the auto-generated key on idempotent endpoints. */
  idempotencyKey?: string;
  /** Extra headers, applied last (e.g. a step-up token on a sensitive read). */
  headers?: Record<string, string>;
}

export type PathParams = Record<string, string>;

/**
 * Query objects arrive as `z.input` of the contract query schemas; `z.coerce` fields type as
 * `unknown`, so the transport narrows values at runtime rather than trusting the compiler.
 */
export type QueryParams = Record<string, unknown>;
