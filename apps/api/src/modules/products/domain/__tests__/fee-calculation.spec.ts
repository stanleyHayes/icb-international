import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { calculateFee, type FeeDefinition } from '../fee-calculation.js';

const USD = 'USD';

function fee(overrides: Partial<FeeDefinition> = {}): FeeDefinition {
  return {
    code: 'WIRE-OUT',
    basis: 'flat',
    amountMinorUnits: 250,
    percentage: null,
    tiers: [],
    minimumMinorUnits: null,
    maximumMinorUnits: null,
    waivedForTiers: [],
    ...overrides,
  };
}

describe('calculateFee', () => {
  it('charges the flat amount regardless of the subject', () => {
    const result = calculateFee(fee(), fromMinorUnits(1_000_000, USD), 'standard');
    expect(result).toEqual({ minorUnits: 250, currency: USD });
  });

  it('treats a null flat amount as free', () => {
    const result = calculateFee(fee({ amountMinorUnits: null }), fromMinorUnits(100, USD), 'standard');
    expect(result.minorUnits).toBe(0);
  });

  it('charges a percentage of the subject', () => {
    const subject = fromMinorUnits(100_000, USD);
    const result = calculateFee(fee({ basis: 'percentage', percentage: 1.5 }), subject, 'standard');
    expect(result.minorUnits).toBe(1_500);
  });

  it('rounds percentage fees half-even to integer minor units', () => {
    const subject = fromMinorUnits(5, USD);
    const result = calculateFee(fee({ basis: 'percentage', percentage: 50 }), subject, 'standard');
    expect(result.minorUnits).toBe(2);
  });

  it('applies the minimum when the percentage falls below it', () => {
    const subject = fromMinorUnits(1_000, USD);
    const result = calculateFee(
      fee({ basis: 'percentage', percentage: 1, minimumMinorUnits: 500 }),
      subject,
      'standard',
    );
    expect(result.minorUnits).toBe(500);
  });

  it('applies the maximum when the percentage exceeds it', () => {
    const subject = fromMinorUnits(10_000_000, USD);
    const result = calculateFee(
      fee({ basis: 'percentage', percentage: 5, maximumMinorUnits: 25_000 }),
      subject,
      'standard',
    );
    expect(result.minorUnits).toBe(25_000);
  });

  it('charges each tier progressively, like a tax bracket', () => {
    const tiered = fee({
      basis: 'tiered',
      tiers: [
        { fromMinorUnits: 0, percentage: 1 },
        { fromMinorUnits: 100_000, percentage: 2 },
      ],
    });
    const result = calculateFee(tiered, fromMinorUnits(200_000, USD), 'standard');
    expect(result.minorUnits).toBe(3_000);
  });

  it('ignores tiers above the subject amount', () => {
    const tiered = fee({
      basis: 'tiered',
      tiers: [
        { fromMinorUnits: 0, percentage: 1 },
        { fromMinorUnits: 100_000, percentage: 2 },
      ],
    });
    const result = calculateFee(tiered, fromMinorUnits(50_000, USD), 'standard');
    expect(result.minorUnits).toBe(500);
  });

  it('reads unordered tier rows correctly', () => {
    const tiered = fee({
      basis: 'tiered',
      tiers: [
        { fromMinorUnits: 100_000, percentage: 2 },
        { fromMinorUnits: 0, percentage: 1 },
      ],
    });
    const result = calculateFee(tiered, fromMinorUnits(200_000, USD), 'standard');
    expect(result.minorUnits).toBe(3_000);
  });

  it('waives the fee entirely for a waived tier', () => {
    const result = calculateFee(
      fee({ basis: 'percentage', percentage: 10, waivedForTiers: ['premier', 'private'] }),
      fromMinorUnits(1_000_000, USD),
      'premier',
    );
    expect(result.minorUnits).toBe(0);
  });

  it('does not waive for a tier that is merely similar', () => {
    const result = calculateFee(
      fee({ waivedForTiers: ['premier'] }),
      fromMinorUnits(1_000, USD),
      'standard',
    );
    expect(result.minorUnits).toBe(250);
  });
});
