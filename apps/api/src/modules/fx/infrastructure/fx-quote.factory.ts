import type { fxQuoteRequestSchema } from '@icb/contracts';
import type { Money } from '@icb/money';

import type { SignedQuoteTerms } from '../domain/quote-signature.js';
import { QUOTE_STATUSES, type FxQuoteDoc } from './fx.schemas.js';

export type FxQuoteRequest = ReturnType<typeof fxQuoteRequestSchema.parse>;

/** The two sides of the trade, after the spread has been applied and the remainder taken out. */
export interface PricedQuote {
  readonly from: Money;
  readonly to: Money;
  readonly roundingDelta: number;
}

export interface NewQuote {
  readonly customerId: string;
  readonly request: FxQuoteRequest;
  readonly priced: PricedQuote;
  readonly rate: number;
  readonly midRate: number;
  readonly spreadBps: number;
  readonly issuedAt: Date;
}

/**
 * The stored quote.
 *
 * It is written `issued` and nothing but `redeem()` may move it on, which is what makes the
 * single-use guarantee a property of the data rather than of the code path that happens to run.
 * The signature is computed over the same terms the customer was shown, so a row edited after
 * the fact stops verifying instead of quietly dealing at a different price.
 */
export function buildQuoteDocument(
  input: NewQuote,
  terms: SignedQuoteTerms,
  signature: string,
): FxQuoteDoc {
  return {
    _id: terms.quoteId,
    customerId: input.customerId,
    fromCurrency: input.request.from,
    toCurrency: input.request.to,
    fromMinorUnits: input.priced.from.minorUnits,
    toMinorUnits: input.priced.to.minorUnits,
    rate: input.rate,
    midRate: input.midRate,
    spreadBps: input.spreadBps,
    roundingDelta: input.priced.roundingDelta,
    amountSide: input.request.amountSide,
    status: QUOTE_STATUSES.ISSUED,
    signature,
    issuedAt: input.issuedAt,
    expiresAt: new Date(terms.expiresAtMs),
    redeemedAt: null,
    redeemedTransactionId: null,
  };
}
