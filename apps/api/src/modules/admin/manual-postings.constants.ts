/** How often the sweeper checks the approval inbox for decided manual postings, in milliseconds. */
export const APPROVED_POSTINGS_SWEEP_MS = 15_000;

/** Label stamped on the staff actor of every manual posting. */
export const MANUAL_POSTING_ACTOR_LABEL = 'admin-manual-posting';

/** Links a ledger transaction back to the manual posting that caused it. */
export const MANUAL_POSTING_SOURCE_TYPE = 'manual_posting';
