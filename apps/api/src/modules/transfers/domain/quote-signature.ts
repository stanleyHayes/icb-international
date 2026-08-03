import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Transfer-quote signing.
 *
 * The signature covers every term the bank is committing to — amounts in both directions, the
 * fee, the rail, the destination and the expiry — so a row edited between issue and redemption
 * stops verifying instead of quietly paying at different terms. Same construction as the FX
 * module's quote signature, scoped to the wider set of transfer terms.
 */
export interface SignedTransferQuoteTerms {
  readonly quoteId: string;
  readonly customerId: string;
  readonly fromAccountId: string;
  readonly rail: string;
  readonly destinationKey: string;
  readonly debitMinorUnits: number;
  readonly debitCurrency: string;
  readonly creditMinorUnits: number;
  readonly creditCurrency: string;
  readonly feeMinorUnits: number;
  readonly fxRate: number | null;
  readonly expiresAtMs: number;
}

function canonicalise(terms: SignedTransferQuoteTerms): string {
  return [
    terms.quoteId,
    terms.customerId,
    terms.fromAccountId,
    terms.rail,
    terms.destinationKey,
    terms.debitMinorUnits,
    terms.debitCurrency,
    terms.creditMinorUnits,
    terms.creditCurrency,
    terms.feeMinorUnits,
    terms.fxRate ?? 'none',
    terms.expiresAtMs,
  ].join('|');
}

export function signTransferQuote(key: string, terms: SignedTransferQuoteTerms): string {
  return createHmac('sha256', key).update(canonicalise(terms)).digest('hex');
}

export function verifyTransferQuote(
  key: string,
  terms: SignedTransferQuoteTerms,
  signature: string,
): boolean {
  const expected = Buffer.from(signTransferQuote(key, terms), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && actual.length > 0 && timingSafeEqual(expected, actual);
}

/** A stable fingerprint of a destination, so the signature binds the quote to its recipient. */
export function destinationFingerprint(destination: Record<string, unknown>): string {
  const entries = Object.entries(destination)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256')
    .update(entries.map(([key, value]) => `${key}=${String(value)}`).join('&'))
    .digest('hex');
}
