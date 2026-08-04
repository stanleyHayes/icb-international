/**
 * Global rate-limit policy.
 *
 * One sliding window per authenticated subject (or per IP before login), sized so ordinary
 * banking use — a session is a few dozen requests — never trips it, while a credential-stuffing
 * or scraping burst does. `ttl` is milliseconds, as @nestjs/throttler v6 expects.
 *
 * Two route classes get tighter ceilings via `@Throttle` at the controller: authentication
 * endpoints (credential stuffing, MFA guessing) and money movement (transfer spam). Both share
 * the global window; only the limit changes.
 */
export const THROTTLE_WINDOW_MS = 60_000;
export const THROTTLE_LIMIT = 120;

/** Login, registration, MFA completion, token refresh: 5 attempts per window per IP. */
export const AUTH_THROTTLE_LIMIT = 5;
/** Transfer creation (single and bulk): 10 per window per customer. */
export const MONEY_MOVEMENT_THROTTLE_LIMIT = 10;
