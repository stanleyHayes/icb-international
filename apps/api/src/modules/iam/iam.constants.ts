/**
 * IAM tuning values.
 *
 * Everything time-based here is a duration; instants come from ClockService (N8), so a
 * simulated clock jump expires approvals and staff sessions exactly as wall time would.
 */

/** Maker-checker request lifetimes. An undecided request expires rather than lingering. */
export const APPROVAL_TTL = {
  /** Default lifetime of an approval request: one business day plus slack. */
  defaultMs: 24 * 3_600_000,
  /** Longest lifetime a requester may ask for. Longer than this, re-request instead. */
  maxMs: 7 * 24 * 3_600_000,
} as const;

/**
 * Staff sessions are deliberately shorter-lived than customer sessions: an operator
 * workstation left unlocked must not stay usable. Consumed by the auth module (BE-04)
 * when issuing/refreshing staff sessions and by `StaffSessionPolicy` when enforcing.
 */
export const STAFF_SESSION_POLICY = {
  /** No activity for this long ends the staff session, however fresh the refresh token. */
  idleTimeoutMs: 15 * 60_000,
  /** Hard cap on a staff session, even with continuous activity. Re-authenticate after. */
  absoluteSessionMs: 8 * 3_600_000,
} as const;

/** Approval statuses that no longer accept a decision. */
export const DECIDED_STATUSES = ['approved', 'rejected', 'expired'] as const;
