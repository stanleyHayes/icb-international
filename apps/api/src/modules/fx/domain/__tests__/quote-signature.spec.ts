import { describe, expect, it } from 'vitest';

import { signQuote, verifyQuote, type SignedQuoteTerms } from '../quote-signature.js';

const KEY = 'test-key';

function terms(overrides: Partial<SignedQuoteTerms> = {}): SignedQuoteTerms {
  return {
    quoteId: 'quote-1',
    customerId: 'cust-1',
    from: 'USD',
    to: 'EUR',
    fromMinorUnits: 10_000,
    toMinorUnits: 9_200,
    rate: 0.92,
    expiresAtMs: 1_800_000_000_000,
    ...overrides,
  };
}

describe('signQuote', () => {
  it('is deterministic over the same terms', () => {
    expect(signQuote(KEY, terms())).toBe(signQuote(KEY, terms()));
  });

  it('changes when any committed term changes', () => {
    const base = signQuote(KEY, terms());
    expect(signQuote(KEY, terms({ rate: 0.93 }))).not.toBe(base);
    expect(signQuote(KEY, terms({ customerId: 'cust-2' }))).not.toBe(base);
  });
});

describe('verifyQuote', () => {
  it('accepts a signature produced from the same terms and key', () => {
    expect(verifyQuote(KEY, terms(), signQuote(KEY, terms()))).toBe(true);
  });

  it('rejects a signature made with a different key', () => {
    expect(verifyQuote(KEY, terms(), signQuote('other-key', terms()))).toBe(false);
  });

  it('rejects a signature over tampered terms', () => {
    const signature = signQuote(KEY, terms());
    expect(verifyQuote(KEY, terms({ toMinorUnits: 1 }), signature)).toBe(false);
  });

  it('rejects a malformed or empty signature without throwing', () => {
    expect(verifyQuote(KEY, terms(), '')).toBe(false);
    expect(verifyQuote(KEY, terms(), 'abcd')).toBe(false);
  });
});
