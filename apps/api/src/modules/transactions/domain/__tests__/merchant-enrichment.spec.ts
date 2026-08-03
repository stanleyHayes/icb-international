import { describe, expect, it } from 'vitest';

import { enrichFromNarrative, enrichMerchant, normaliseNarrative } from '../merchant-enrichment.js';

describe('normaliseNarrative', () => {
  it('strips acquirer prefixes and store numbers', () => {
    expect(normaliseNarrative('POS SHELL FUEL STATION #0042')).toBe('SHELL FUEL STATION');
    expect(normaliseNarrative('SQ *The Copper Kettle café 12')).toBe('THE COPPER KETTLE CAFÉ');
  });

  it('drops the em-dash hint the seed appends', () => {
    expect(normaliseNarrative('Meridian Properties — rent')).toBe('MERIDIAN PROPERTIES');
  });

  it('collapses whitespace and upper-cases', () => {
    expect(normaliseNarrative('  metro   transit top-up ')).toBe('METRO TRANSIT TOP-UP');
  });
});

describe('enrichMerchant', () => {
  it('resolves directory merchants with MCC-derived category and locality', () => {
    const merchant = enrichMerchant('Palm Grove Supermarket — weekly shop', 'card_purchase', 'groceries');

    expect(merchant).toEqual({
      name: 'Palm Grove Supermarket',
      category: 'groceries',
      mcc: '5411',
      city: 'Accra',
      country: 'GH',
      logoUrl: null,
    });
  });

  it('resolves global brands without a locality', () => {
    const merchant = enrichMerchant('Netflix subscription', 'transfer_out', 'subscriptions');

    expect(merchant?.name).toBe('Netflix');
    expect(merchant?.category).toBe('subscriptions');
    expect(merchant?.city).toBeNull();
    expect(merchant?.country).toBeNull();
  });

  it('matches the directory regardless of transaction type', () => {
    // A standing-order debit to a known merchant is still that merchant.
    expect(enrichMerchant('Volta Power — electricity', 'transfer_out', 'utilities')?.mcc).toBe('4900');
  });

  it('builds a cleaned fallback merchant for unlisted card purchases', () => {
    const merchant = enrichMerchant('CARD PURCHASE CORNER BAKERY 7', 'card_purchase', 'dining');

    expect(merchant).toEqual({
      name: 'Corner Bakery',
      category: 'dining',
      mcc: null,
      city: null,
      country: null,
      logoUrl: null,
    });
  });

  it('returns null for non-merchant activity that hits no directory entry', () => {
    expect(enrichMerchant('Salary — Acme Corp', 'transfer_in', 'salary')).toBeNull();
    expect(enrichMerchant('Monthly account fee', 'fee', 'fees')).toBeNull();
  });

  it('returns null for an empty narrative', () => {
    expect(enrichMerchant('', 'card_purchase', 'other')).toBeNull();
  });

  it('is deterministic — same input, same merchant, every time', () => {
    const first = enrichFromNarrative('Ember Kitchen restaurant', 'card_purchase');
    const second = enrichFromNarrative('Ember Kitchen restaurant', 'card_purchase');
    expect(first).toEqual(second);
  });
});
