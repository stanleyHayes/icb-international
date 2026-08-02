import { idempotencyKeySchema } from '@icb/contracts';

import { IcbUsageError } from './errors.js';

/**
 * The key attached to every mutating money endpoint (agent_plan.md N6). Defaults to a UUID;
 * a caller-supplied key is validated against the contract so a replay-safe key is never
 * rejected by the API for shape alone.
 */
export function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function resolveIdempotencyKey(override: string | undefined): string {
  if (override === undefined) return createIdempotencyKey();
  if (!idempotencyKeySchema.safeParse(override).success) {
    throw new IcbUsageError('Idempotency keys must be 8–128 characters');
  }
  return override;
}
