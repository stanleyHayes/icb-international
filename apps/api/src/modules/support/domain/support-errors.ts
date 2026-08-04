import { DomainError } from '../../../common/errors/domain.error.js';

/**
 * Support domain errors. Each carries a stable `ErrorCode` from the contract so the client can
 * branch on the code rather than the message.
 */

/** A reply was attempted on a ticket whose thread is closed. */
export class TicketClosedError extends DomainError {
  constructor(ticketId: string) {
    super('CONFLICT', 'This ticket is closed and can no longer be replied to', {
      context: { ticketId },
    });
  }
}

/** CSAT was submitted for a ticket that is not resolved yet, or was already rated. */
export class SatisfactionNotAllowedError extends DomainError {
  constructor(ticketId: string, reason: string) {
    super('CONFLICT', reason, { context: { ticketId } });
  }
}

/** A callback request was completed or cancelled twice. */
export class CallbackAlreadyHandledError extends DomainError {
  constructor(callbackId: string) {
    super('CONFLICT', 'This callback request has already been handled', {
      context: { callbackId },
    });
  }
}

/** A macro template references variables the renderer does not know. */
export class UnknownMacroVariableError extends DomainError {
  constructor(variables: readonly string[]) {
    super('VALIDATION_FAILED', 'The macro template uses unknown variables', {
      fieldErrors: variables.map((name) => ({
        path: 'body',
        message: `Unknown variable {{${name}}}`,
      })),
    });
  }
}
