/** Drain polling and retry policy for the transactional outbox. */
export const OUTBOX_POLL_INTERVAL_MS = 1_000;
export const OUTBOX_BATCH_LIMIT = 50;
export const OUTBOX_MAX_ATTEMPTS = 10;
export const OUTBOX_BASE_BACKOFF_MS = 500;
export const OUTBOX_MAX_BACKOFF_MS = 60_000;
