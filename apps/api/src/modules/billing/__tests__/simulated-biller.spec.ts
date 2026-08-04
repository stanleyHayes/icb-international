import { describe, expect, it } from 'vitest';

import {
  decideOutcome,
  enquireBalance,
  type SimulatedBiller,
} from '../domain/simulated-biller.js';

const BILLER: SimulatedBiller = {
  code: 'NATIONAL_GRID_POSTPAID',
  supportsBalanceEnquiry: true,
  typicalBillMinorUnits: 10_000,
  minimumAmountMinorUnits: 500,
  failureRate: 0,
};

describe('enquireBalance', () => {
  it('returns null for a biller that publishes no balance', () => {
    expect(
      enquireBalance({ ...BILLER, supportsBalanceEnquiry: false }, 'ref-1', '2026-08'),
    ).toBeNull();
  });

  it('is idempotent within a cycle', () => {
    expect(enquireBalance(BILLER, 'ref-1', '2026-08')).toEqual(
      enquireBalance(BILLER, 'ref-1', '2026-08'),
    );
  });

  it('quotes a rounded figure near the typical bill, never below the minimum', () => {
    for (let index = 0; index < 20; index += 1) {
      const enquiry = enquireBalance(BILLER, `ref-${index}`, '2026-08');
      expect(enquiry).not.toBeNull();
      // Factor range is [0.65, 1.5), rounded to the nearest 10.
      expect(enquiry?.outstandingMinorUnits).toBeGreaterThanOrEqual(500);
      expect(enquiry?.outstandingMinorUnits).toBeLessThanOrEqual(15_000);
      expect((enquiry?.outstandingMinorUnits ?? 1) % 10).toBe(0);
      expect(enquiry?.cycle).toBe('2026-08');
    }
  });

  it('falls due on a mid-to-late month day within the cycle', () => {
    for (let index = 0; index < 20; index += 1) {
      const enquiry = enquireBalance(BILLER, `ref-${index}`, '2026-08');
      const day = Number(enquiry?.dueOn.slice(8, 10));
      expect(enquiry?.dueOn.startsWith('2026-08-')).toBe(true);
      expect(day).toBeGreaterThanOrEqual(12);
      expect(day).toBeLessThanOrEqual(25);
    }
  });

  it('never quotes below a high minimum even when the factor is low', () => {
    const biller = { ...BILLER, minimumAmountMinorUnits: 20_000 };
    for (let index = 0; index < 10; index += 1) {
      expect(enquireBalance(biller, `ref-${index}`, '2026-08')?.outstandingMinorUnits).toBe(20_000);
    }
  });
});

describe('decideOutcome', () => {
  it('accepts the payment when the roll clears the failure rate', () => {
    const outcome = decideOutcome(BILLER, 'payment-1');

    expect(outcome.failed).toBe(false);
    expect(outcome.failureReason).toBeNull();
    // NATIONAL_GRID_POSTPAID initials, truncated to three characters.
    expect(outcome.billerReference).toMatch(/^NGP-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('rejects the payment with a quotable reason when the roll lands under the rate', () => {
    const outcome = decideOutcome({ ...BILLER, failureRate: 1 }, 'payment-1');

    expect(outcome.failed).toBe(true);
    expect(outcome.billerReference).toBeNull();
    expect(outcome.failureReason).toBeTruthy();
    expect(decideOutcome({ ...BILLER, failureRate: 1 }, 'payment-1')).toEqual(outcome);
  });
});
