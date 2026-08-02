/** Header carrying the request correlation id through HTTP, logs, queues and audit events. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Header the client sends to make a mutating money endpoint safe to retry. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Names the deployment that answered, so a support trace can be tied to an environment. */
export const ENVIRONMENT_HEADER = 'x-icb-environment';
