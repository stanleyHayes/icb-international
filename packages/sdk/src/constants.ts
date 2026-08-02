/**
 * Shared constants for the ICB SDK. No literals elsewhere in the package.
 */

/** Every API route is versioned under this prefix (agent_plan.md BE-01). */
export const API_VERSION_PREFIX = '/v1';

/** Local dev default, matching API_PORT in .env.example. */
export const DEFAULT_BASE_URL = 'http://localhost:4100';

export const HEADER_AUTHORIZATION = 'Authorization';
export const HEADER_IDEMPOTENCY_KEY = 'Idempotency-Key';
export const HEADER_CONTENT_TYPE = 'Content-Type';
export const HEADER_ACCEPT = 'Accept';
export const HEADER_CORRELATION_ID = 'x-correlation-id';

export const MIME_JSON = 'application/json';
export const BEARER_SCHEME = 'Bearer';

/** The refresh endpoint itself is excluded from the refresh-on-401 retry. */
export const REFRESH_PATH = '/auth/refresh';

export const HTTP_STATUS_NO_CONTENT = 204;
export const HTTP_STATUS_UNAUTHORIZED = 401;

export const UNKNOWN_CORRELATION_ID = 'unknown';
