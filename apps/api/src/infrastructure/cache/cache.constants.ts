/** Cache keying and TTL policy. */
export const CACHE_KEY_PREFIX = 'icb';
export const DEFAULT_TTL_SECONDS = 300;
export const MIN_TTL_SECONDS = 1;
export const MAX_TTL_SECONDS = 86_400;

/**
 * Hard bound on entries held in memory.
 *
 * The cache lives in the API process now, so an unbounded map is a slow leak: every distinct
 * key is retained until its TTL expires, and expiry is only noticed on read. The bound makes
 * the worst case a fixed cost rather than a growing one.
 */
export const MAX_ENTRIES = 5_000;
