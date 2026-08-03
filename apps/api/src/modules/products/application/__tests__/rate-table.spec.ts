import { describe, expect, it } from 'vitest';

import type { ProductDoc } from '../../infrastructure/product.schemas.js';
import { buildRateTable } from '../rate-table.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const BEFORE = new Date('2026-07-01T00:00:00.000Z');
const AFTER = new Date('2026-09-01T00:00:00.000Z');

function doc(overrides: Partial<ProductDoc>): ProductDoc {
  return {
    _id: '01J00000000000000000000000',
    code: 'ICB-SAVINGS',
    name: 'ICB Reserve Savings',
    tagline: 't',
    description: 'd',
    kind: 'savings',
    currencies: ['USD'],
    interestRate: 4.15,
    interestBands: null,
    rateSchedule: [],
    minimumOpeningBalanceMinorUnits: null,
    minimumBalanceMinorUnits: null,
    monthlyFeeMinorUnits: null,
    fees: [],
    features: [],
    eligibility: { minimumAge: 18, minimumKycLevel: 'tier_1', residentsOnly: false, businessOnly: false },
    limits: [],
    depositTerms: [],
    loanRateRange: null,
    active: true,
    displayOrder: 1,
    version: 1,
    ...overrides,
  };
}

describe('buildRateTable', () => {
  it('lists current and savings products with their base rate', () => {
    const table = buildRateTable(
      [doc({ code: 'ICB-CURRENT', kind: 'current', interestRate: 0.25 }), doc({})],
      NOW,
    );
    expect(table.savings.map((row) => row.productCode)).toEqual(['ICB-CURRENT', 'ICB-SAVINGS']);
  });

  it('prefers a schedule entry in force over the base rate', () => {
    const table = buildRateTable(
      [doc({ rateSchedule: [{ effectiveFrom: BEFORE, rate: 4.5 }] })],
      NOW,
    );
    expect(table.savings[0]?.rate).toBeCloseTo(4.5);
  });

  it('ignores schedule entries that have not taken effect yet', () => {
    const table = buildRateTable([doc({ rateSchedule: [{ effectiveFrom: AFTER, rate: 9.9 }] })], NOW);
    expect(table.savings[0]?.rate).toBeCloseTo(4.15);
  });

  it('omits products with no rate at all', () => {
    const table = buildRateTable([doc({ interestRate: null })], NOW);
    expect(table.savings).toEqual([]);
  });

  it('flattens fixed-deposit term sheets with their minimum amounts', () => {
    const table = buildRateTable(
      [
        doc({
          kind: 'fixed_deposit',
          depositTerms: [
            { termMonths: 6, rate: 5.0, minimumMinorUnits: 100_000 },
            { termMonths: 12, rate: 5.6, minimumMinorUnits: 100_000 },
          ],
        }),
      ],
      NOW,
    );
    expect(table.deposits).toEqual([
      { termMonths: 6, rate: 5.0, minimumAmount: { minorUnits: 100_000, currency: 'USD', scale: 2 } },
      { termMonths: 12, rate: 5.6, minimumAmount: { minorUnits: 100_000, currency: 'USD', scale: 2 } },
    ]);
  });

  it('lists loan products with their advertised band', () => {
    const table = buildRateTable(
      [doc({ kind: 'loan', loanRateRange: { fromRate: 9.9, toRate: 24.5 } })],
      NOW,
    );
    expect(table.loans).toEqual([
      { productCode: 'ICB-SAVINGS', name: 'ICB Reserve Savings', fromRate: 9.9, toRate: 24.5 },
    ]);
  });

  it('dates the table at the newest schedule change in force', () => {
    const table = buildRateTable(
      [doc({ rateSchedule: [{ effectiveFrom: BEFORE, rate: 4.5 }] })],
      NOW,
    );
    expect(table.effectiveFrom).toBe(BEFORE.toISOString());
  });

  it('falls back to the as-of instant when nothing has a schedule', () => {
    const table = buildRateTable([doc({})], NOW);
    expect(table.effectiveFrom).toBe(NOW.toISOString());
  });
});
