/**
 * Disputes module tuning.
 *
 * The watch interval trades customer-perceived latency against collection scans: five seconds is
 * fast enough that a stage change feels immediate in the notification feed, slow enough that the
 * scan is lost in the noise of normal traffic.
 */
export const DISPUTE_EVENT_TYPES = {
  StageChanged: 'dispute.stage_changed',
  SlaBreached: 'dispute.sla_breached',
} as const;
export type DisputeEventType = (typeof DISPUTE_EVENT_TYPES)[keyof typeof DISPUTE_EVENT_TYPES];

/** Consumer identity under which this module claims comms events from the outbox. */
export const DISPUTE_COMMS_CONSUMER = 'dispute-comms';

export const WATCH_INTERVAL_MS = 5_000;
export const WATCH_BATCH_LIMIT = 100;
