/** Header carrying the request correlation id through HTTP, logs, queues and audit events. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Header the client sends to make a mutating money endpoint safe to retry. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Marks which deployment answered. The only outward trace of the simulation boundary — see
 * agent_plan.md N1. Customers never see it; engineers always can.
 */
export const ENVIRONMENT_HEADER = 'x-icb-environment';
