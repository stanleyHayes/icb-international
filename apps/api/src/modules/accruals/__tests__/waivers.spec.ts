import { describe, expect, it } from 'vitest';

import { FEE_CODES } from '../accruals.constants.js';
import { chargeableOverdraftBase, waiverReason, type WaiverContext } from '../domain/waivers.js';

function context(overrides: Partial<WaiverContext> = {}): WaiverContext {
  return {
    customerTier: 'standard',
    balanceMinorUnits: 100_000,
    minimumBalanceMinorUnits: null,
    availableMinorUnits: 100_000,
    ...overrides,
  };
}

describe('waiverReason', () => {
  it('waives nothing for a standard customer who can afford the fee', () => {
    expect(waiverReason(FEE_CODES.maintenance, 500, context())).toBeNull();
  });

  it('waives for a fee-free package tier', () => {
    expect(waiverReason(FEE_CODES.maintenance, 500, context({ customerTier: 'premium' }))).toBe(
      'Fee waived for premium tier',
    );
    expect(waiverReason(FEE_CODES.transaction, 150, context({ customerTier: 'private' }))).toBe(
      'Fee waived for private tier',
    );
  });

  it('waives the maintenance fee when the minimum balance was maintained', () => {
    const waived = waiverReason(
      FEE_CODES.maintenance,
      500,
      context({ balanceMinorUnits: 200_000, minimumBalanceMinorUnits: 200_000 }),
    );
    expect(waived).toBe('Minimum balance maintained');
  });

  it('does not apply the minimum-balance rule to other fee types', () => {
    const result = waiverReason(
      FEE_CODES.transaction,
      150,
      context({ balanceMinorUnits: 200_000, minimumBalanceMinorUnits: 200_000 }),
    );
    expect(result).toBeNull();
  });

  it('waives a fee the account cannot afford rather than forcing an overdraft', () => {
    expect(waiverReason(FEE_CODES.maintenance, 500, context({ availableMinorUnits: 499 }))).toBe(
      'Insufficient available balance',
    );
  });

  it('lets the deliberate waiver win over affordability', () => {
    const waived = waiverReason(
      FEE_CODES.maintenance,
      500,
      context({ customerTier: 'premium', availableMinorUnits: 0 }),
    );
    expect(waived).toBe('Fee waived for premium tier');
  });

  it('treats a zero amount as nothing to charge', () => {
    expect(waiverReason(FEE_CODES.maintenance, 0, context())).toBe('Nothing to charge');
  });
});

describe('chargeableOverdraftBase', () => {
  it('is the overdrawn amount within the arranged limit', () => {
    expect(chargeableOverdraftBase(80_000, 500_000)).toBe(80_000);
  });

  it('caps at the arranged limit', () => {
    expect(chargeableOverdraftBase(600_000, 500_000)).toBe(500_000);
  });

  it('is zero without an arranged facility', () => {
    expect(chargeableOverdraftBase(80_000, 0)).toBe(0);
  });

  it('is zero when the account is not overdrawn', () => {
    expect(chargeableOverdraftBase(0, 500_000)).toBe(0);
  });
});
