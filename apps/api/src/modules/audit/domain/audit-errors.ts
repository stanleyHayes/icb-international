import { DomainError } from '../../../common/errors/index.js';
import { DUPLICATE_KEY_CODE } from '../audit.constants.js';

/**
 * Raised when anything tries to mutate or delete an audit event.
 *
 * The trail is append-only (agent_plan.md N7): a correction is a new event, never an edit, so
 * the schema registers this on every mutating middleware path and the exception escapes before
 * the operation reaches Mongo.
 */
export class AuditImmutableError extends DomainError {
  constructor(operation: string) {
    super('CONFLICT', 'Audit events are append-only and cannot be modified or deleted', {
      context: { operation },
    });
  }
}

/** Mongo duplicate-key detection — the signal that a concurrent append won the sequence race. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY_CODE
  );
}
