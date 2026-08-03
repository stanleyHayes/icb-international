/**
 * Audit-trail constants.
 *
 * The chain is only as strong as its genesis being unambiguous: a first event hashes against
 * sixty-four zero hex digits, so a forged "first" row cannot hide behind a null previousHash.
 */
export const GENESIS_HASH = '0'.repeat(64);

/** Mongo duplicate-key error code, raised when two appends race for the same sequence. */
export const DUPLICATE_KEY_CODE = 11000;

/** Lost-append retries before surfacing the failure — a race resolves in one retry, almost always. */
export const MAX_APPEND_ATTEMPTS = 3;

/** Documents pulled per round-trip when walking the chain or streaming an export. */
export const WALK_BATCH_SIZE = 500;

/** Hard ceiling on a single export so an unbounded query cannot exhaust the API process. */
export const MAX_EXPORT_ROWS = 10_000;

/** Marker used in a change row for a field that exists on only one side of the diff. */
export const ABSENT_VALUE = '(absent)';

/** Truncation ceiling for a single change value — a diff row is a summary, not a document store. */
export const CHANGE_VALUE_MAX_LENGTH = 200;

/** Correlation id for events raised outside an HTTP request (jobs, seeds, bootstraps). */
export const SYSTEM_CORRELATION_ID = 'system';

/** Content type of the export endpoint — one JSON document per line. */
export const NDJSON_CONTENT_TYPE = 'application/x-ndjson';
