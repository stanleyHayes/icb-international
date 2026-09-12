import type { TransferStatus } from '@icb/contracts';

import { DomainError } from '../../../common/errors/index.js';

/** A cancel was attempted on a transfer that has already moved past the point of recall. */
export class TransferNotCancellableError extends DomainError {
  constructor(transferId: string, status: TransferStatus) {
    super('TRANSFER_NOT_CANCELLABLE', 'This transfer can no longer be cancelled', {
      context: { transferId, status },
    });
  }
}

/** The transfer quote's TTL elapsed before it was redeemed. */
export class TransferQuoteExpiredError extends DomainError {
  constructor(quoteId: string, expiresAt: Date) {
    super('QUOTE_EXPIRED', 'This quote has expired — please request a new one', {
      context: { quoteId, expiresAt: expiresAt.toISOString() },
    });
  }
}

/** Quotes are single-use; a second redemption loses the race. */
export class TransferQuoteAlreadyUsedError extends DomainError {
  constructor(quoteId: string) {
    super('QUOTE_ALREADY_USED', 'This quote has already been used', {
      context: { quoteId },
    });
  }
}

/** A stored quote no longer verifies against its signature — it was tampered with. */
export class TransferQuoteSignatureInvalidError extends DomainError {
  constructor(quoteId: string) {
    super('CONFLICT', 'This quote could not be verified', { context: { quoteId } });
  }
}

/** The fraud engine refused the payment outright. */
export class TransferBlockedError extends DomainError {
  constructor(transferReference: string, assessmentId: string) {
    super('RISK_BLOCKED', 'This transfer cannot be completed', {
      context: { reference: transferReference, assessmentId },
    });
  }
}

/** A recurrence rule the scheduler cannot honour. */
export class InvalidScheduleError extends DomainError {
  constructor(reason: string) {
    super('VALIDATION_FAILED', `The schedule is invalid: ${reason}`, {
      fieldErrors: [{ path: 'schedule.rrule', message: reason }],
    });
  }
}

/** A bulk row failed validation before anything executed. */
export class BulkTransferValidationError extends DomainError {
  constructor(failures: readonly { rowNumber: number; code: string; message: string }[]) {
    super('VALIDATION_FAILED', 'The bulk upload contains rows that cannot be paid', {
      context: { failures },
    });
  }
}

/**
 * An international send from a tier that has not unlocked them.
 *
 * `FORBIDDEN` rather than `LIMIT_EXCEEDED`: no amount would have been accepted, so telling the
 * customer they exceeded a ceiling would send them to reduce a number that was never the
 * problem. What they need is the next verification tier.
 */
export class InternationalNotPermittedError extends DomainError {
  constructor(tierLabel: string) {
    super(
      'FORBIDDEN',
      'International transfers need a higher verification tier on your account',
      { context: { tier: tierLabel } },
    );
  }
}
