import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Quote signing.
 *
 * The signature covers every term the bank is committing to. Recomputing it at redemption is
 * what makes "the price you were shown is the price you get" checkable rather than assumed — if
 * a row is edited in the database between issue and redemption, the quote stops being honoured
 * instead of silently dealing at the new number.
 */

export interface SignedQuoteTerms {
  readonly quoteId: string;
  readonly customerId: string;
  readonly from: string;
  readonly to: string;
  readonly fromMinorUnits: number;
  readonly toMinorUnits: number;
  readonly rate: number;
  readonly expiresAtMs: number;
}

function canonicalise(terms: SignedQuoteTerms): string {
  return [
    terms.quoteId,
    terms.customerId,
    terms.from,
    terms.to,
    terms.fromMinorUnits,
    terms.toMinorUnits,
    terms.rate,
    terms.expiresAtMs,
  ].join('|');
}

export function signQuote(key: string, terms: SignedQuoteTerms): string {
  return createHmac('sha256', key).update(canonicalise(terms)).digest('hex');
}

export function verifyQuote(key: string, terms: SignedQuoteTerms, signature: string): boolean {
  const expected = Buffer.from(signQuote(key, terms), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && actual.length > 0 && timingSafeEqual(expected, actual);
}
