import { DomainError } from '../../../common/errors/index.js';

/**
 * A quote is a promise the bank made about a price for a bounded time. These are the two ways
 * that promise stops being available — and they are distinct on purpose, because "too late" and
 * "already spent" need different words in the app.
 */

export class QuoteExpiredError extends DomainError {
  constructor(quoteId: string, expiredAt: Date) {
    super('QUOTE_EXPIRED', 'This rate has expired. Ask for a new quote.', {
      context: { quoteId, expiredAt: expiredAt.toISOString() },
    });
  }
}

export class QuoteAlreadyUsedError extends DomainError {
  constructor(quoteId: string, redeemedAt: Date | null) {
    super('QUOTE_ALREADY_USED', 'This quote has already been used', {
      context: { quoteId, redeemedAt: redeemedAt?.toISOString() ?? null },
    });
  }
}

/** The stored signature did not verify: the row was edited outside the application. */
export class QuoteSignatureInvalidError extends DomainError {
  constructor(quoteId: string) {
    super('QUOTE_EXPIRED', 'This quote could not be verified and will not be honoured', {
      context: { quoteId, reason: 'signature_mismatch' },
    });
  }
}
