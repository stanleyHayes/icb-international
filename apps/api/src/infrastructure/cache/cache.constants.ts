/** Cache keying and TTL policy. */
export const CACHE_KEY_PREFIX = 'icb';
export const DEFAULT_TTL_SECONDS = 300;
export const MIN_TTL_SECONDS = 1;
export const MAX_TTL_SECONDS = 86_400;

/** One failed command must not hang a request on a reconnecting client. */
export const MAX_RETRIES_PER_REQUEST = 2;
