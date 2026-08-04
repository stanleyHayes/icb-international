import { describe, expect, it } from 'vitest';

import { DEFAULT_SPREAD_BPS, dealtRates, spreadBpsForTier } from '../fx-spread.js';

describe('spreadBpsForTier', () => {
  it('prices each known tier at its published spread', () => {
    expect(spreadBpsForTier('standard')).toBe(90);
    expect(spreadBpsForTier('plus')).toBe(65);
    expect(spreadBpsForTier('premier')).toBe(45);
    expect(spreadBpsForTier('private')).toBe(25);
  });

  it('falls back to the standard spread for missing or unknown tiers', () => {
    expect(spreadBpsForTier(null)).toBe(DEFAULT_SPREAD_BPS);
    expect(spreadBpsForTier(undefined)).toBe(DEFAULT_SPREAD_BPS);
    expect(spreadBpsForTier('gold-platinum-ultra')).toBe(DEFAULT_SPREAD_BPS);
    expect(spreadBpsForTier('')).toBe(DEFAULT_SPREAD_BPS);
  });
});

describe('dealtRates', () => {
  it('straddles the mid with the bank on the profitable side of both', () => {
    const { buy, sell } = dealtRates(1, 90);

    expect(buy).toBeLessThan(1);
    expect(sell).toBeGreaterThan(1);
  });

  it('widens with the spread', () => {
    const narrow = dealtRates(1, 25);
    const wide = dealtRates(1, 90);
    expect(wide.buy).toBeLessThan(narrow.buy);
    expect(wide.sell).toBeGreaterThan(narrow.sell);
  });

  it('deals at the mid when the spread is zero', () => {
    expect(dealtRates(1.25, 0)).toEqual({ buy: 1.25, sell: 1.25 });
  });
});
