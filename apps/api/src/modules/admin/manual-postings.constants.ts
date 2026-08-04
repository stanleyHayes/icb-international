/** Queue the approved-manual-posting sweep is dispatched through. */
export const ADMIN_POSTINGS_QUEUE = 'admin-postings';

/** The one job the admin postings queue carries: post everything newly approved. */
export const ADMIN_POSTING_JOB_NAMES = { sweepApproved: 'sweep-approved-postings' } as const;

/**
 * Fixed scheduler id, so re-registering the sweep on every boot is an upsert at the queue
 * rather than a duplicate repeatable job.
 */
export const APPROVED_POSTINGS_SCHEDULER_ID = 'approved-postings-sweep';

/** How often the worker sweeps the approval inbox for decided manual postings, in milliseconds. */
export const APPROVED_POSTINGS_SWEEP_MS = 15_000;

/** Label stamped on the staff actor of every manual posting. */
export const MANUAL_POSTING_ACTOR_LABEL = 'admin-manual-posting';

/** Links a ledger transaction back to the manual posting that caused it. */
export const MANUAL_POSTING_SOURCE_TYPE = 'manual_posting';
