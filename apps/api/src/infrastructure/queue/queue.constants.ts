import type { DefaultJobOptions } from 'bullmq';

/** Queue receiving jobs that exhausted their retries; inspected by operations tooling. */
export const DEAD_LETTER_QUEUE = 'dead-letter';
export const DEAD_LETTER_JOB_NAME = 'exhausted-job';

/**
 * Retry policy for every queue in the system.
 *
 * Exponential backoff from one second gives a transient dependency (Redis hiccup, Mongo
 * failover) time to recover; keeping failed jobs (`removeOnFail: false`) preserves the evidence
 * for anything that still ends up dead-lettered.
 */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: false,
};
