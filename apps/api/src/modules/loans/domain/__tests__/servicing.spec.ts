import { fromMinorUnits, zero, type CurrencyCode } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { ageArrears, bucketFor } from '../arrears.js';
import { decide } from '../decision.js';
import { getLoanProduct } from '../loan-products.js';
import { accrueInterest, buildPayoffQuote } from '../payoff.js';
import { affordablePrincipal, indicativeRate, maximumMonthlyInstalment } from '../pricing.js';
import { buildQuote } from '../quote-builder.js';
import { allocateRepayment, totalOutstanding } from '../repayment-allocation.js';
import { score } from '../scorecard.js';
import { addPeriods, daysBetweenIso, dueDateSequence } from '../schedule-dates.js';

const USD: CurrencyCode = 'USD';
const usd = (minorUnits: number) => fromMinorUnits(minorUnits, USD);
const DRAWDOWN = new Date('2026-01-31T09:00:00.000Z');

describe('schedule dates', () => {
  it('falls due one full period after drawdown, never on the drawdown day', () => {
    const dates = dueDateSequence(DRAWDOWN, 3, 'monthly');
    expect(dates[0]).not.toBe('2026-01-31');
    expect(dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('steps whole weeks and fortnights', () => {
    expect(dueDateSequence(DRAWDOWN, 2, 'weekly')).toEqual(['2026-02-07', '2026-02-14']);
    expect(dueDateSequence(DRAWDOWN, 1, 'fortnightly')).toEqual(['2026-02-14']);
  });

  it('advances quarters three months at a time', () => {
    expect(addPeriods(DRAWDOWN, 2, 'quarterly').toISOString().slice(0, 10)).toBe('2026-07-31');
  });

  it('counts whole days between calendar dates in both directions', () => {
    expect(daysBetweenIso('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetweenIso('2026-01-31', '2026-01-01')).toBe(-30);
  });
});

describe('buildQuote', () => {
  const product = getLoanProduct('PERSONAL_STANDARD');
  const quote = buildQuote({
    product,
    principal: usd(1_000_000),
    annualRatePercent: 12,
    termMonths: 36,
    frequency: 'monthly',
    anchor: DRAWDOWN,
    indicative: true,
  });

  it('publishes one schedule row per instalment, all unpaid', () => {
    expect(quote.schedule).toHaveLength(36);
    expect(quote.schedule.every((row) => row.status === 'scheduled')).toBe(true);
    expect(quote.schedule.every((row) => row.paidAmount === null)).toBe(true);
  });

  it('totals repayable as principal plus interest plus the arrangement fee', () => {
    expect(quote.arrangementFee.minorUnits).toBe(10_000);
    expect(quote.totalRepayable.minorUnits).toBe(
      quote.amount.minorUnits + quote.totalInterest.minorUnits + quote.arrangementFee.minorUnits,
    );
  });

  it('quotes an APR above the nominal rate, because the fee is part of the cost', () => {
    expect(quote.representativeApr).toBeGreaterThan(quote.nominalRate);
    expect(quote.indicative).toBe(true);
    expect(quote.firstPaymentOn).toBe('2026-02-28');
  });

  it('prices better relationships nearer the headline rate', () => {
    expect(indicativeRate(product, 'private')).toBe(product.fromRate);
    expect(indicativeRate(product, 'standard')).toBeGreaterThan(indicativeRate(product, 'premier'));
  });
});

describe('scorecard and decision', () => {
  const product = getLoanProduct('PERSONAL_STANDARD');

  const assess = (overrides: Partial<Parameters<typeof score>[0]> = {}) =>
    score({
      monthlyIncome: usd(800_000),
      monthlyExpenses: usd(200_000),
      existingCommitments: usd(50_000),
      requestedAmount: usd(1_000_000),
      instalment: usd(33_000),
      termMonths: 36,
      tier: 'premier',
      kycLevel: 'tier_3',
      arrearsCount: 0,
      ...overrides,
    });

  it('never scores outside 0…1000 and always explains itself', () => {
    const strong = assess();
    expect(strong.score).toBeGreaterThanOrEqual(0);
    expect(strong.score).toBeLessThanOrEqual(1000);
    expect(strong.factors.length).toBeGreaterThan(0);
    expect(strong.factors.every((factor) => factor.detail !== null)).toBe(true);
    expect(strong.factors.reduce((total, factor) => total + factor.weight, 0)).toBe(1000);
  });

  it('scores a stretched applicant below a comfortable one', () => {
    const stretched = assess({ monthlyExpenses: usd(700_000), existingCommitments: usd(90_000) });
    expect(stretched.score).toBeLessThan(assess().score);
  });

  const judge = (overrides: Partial<Parameters<typeof score>[0]> = {}, affordable = usd(2_000_000)) =>
    decide({
      scorecard: assess(overrides),
      product,
      requestedAmount: usd(1_000_000),
      termMonths: 36,
      maximumAffordable: affordable,
      arrearsCount: overrides.arrearsCount ?? 0,
      kycVerified: overrides.kycLevel !== null,
      decidedBy: 'scorecard',
      decidedAt: DRAWDOWN,
    });

  it('approves a strong application and prices it inside the product band', () => {
    const decision = judge();
    expect(decision.outcome).toBe('approved');
    expect(decision.approvedRate).toBeGreaterThanOrEqual(product.fromRate);
    expect(decision.approvedRate).toBeLessThanOrEqual(product.toRate);
    expect(decision.approvedAmount?.minorUnits).toBe(1_000_000);
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  it('refers rather than approves when identity is unverified', () => {
    const decision = judge({ kycLevel: null });
    expect(decision.outcome).toBe('referred');
    expect(decision.approvedAmount).toBeNull();
    expect(decision.reasons.join(' ')).toMatch(/verification/i);
  });

  it('declines when the repayment would swallow the income', () => {
    const decision = judge({ instalment: usd(600_000), monthlyExpenses: usd(400_000) });
    expect(decision.outcome).toBe('declined');
    expect(decision.approvedRate).toBeNull();
  });

  it('declines when nothing is affordable at all', () => {
    expect(judge({}, zero(USD)).outcome).toBe('declined');
  });
});

describe('repayment allocation', () => {
  const outstanding = { fees: usd(2_500), interest: usd(7_500), principal: usd(90_000) };

  it('settles fees, then interest, then principal — in that order', () => {
    const partial = allocateRepayment(usd(9_000), outstanding);
    expect(partial.fees.minorUnits).toBe(2_500);
    expect(partial.interest.minorUnits).toBe(6_500);
    expect(partial.principal.minorUnits).toBe(0);
    expect(partial.applied.minorUnits).toBe(9_000);
  });

  it('never loses a cent: the components always re-sum to what was applied', () => {
    for (const amount of [1, 2_499, 2_500, 10_001, 99_999, 100_000]) {
      const allocation = allocateRepayment(usd(amount), outstanding);
      const parts =
        allocation.fees.minorUnits +
        allocation.interest.minorUnits +
        allocation.principal.minorUnits;
      expect(parts).toBe(allocation.applied.minorUnits);
      expect(allocation.applied.minorUnits + allocation.unallocated.minorUnits).toBe(amount);
    }
  });

  it('reports an overpayment rather than absorbing it', () => {
    const allocation = allocateRepayment(usd(150_000), outstanding);
    expect(allocation.unallocated.minorUnits).toBe(50_000);
    expect(totalOutstanding(outstanding).minorUnits).toBe(100_000);
  });

  it('refuses a non-positive repayment', () => {
    expect(() => allocateRepayment(zero(USD), outstanding)).toThrow(/greater than zero/);
  });
});

describe('arrears ageing', () => {
  const rows = [
    { dueOn: '2026-01-15', outstandingMinorUnits: 30_000 },
    { dueOn: '2026-02-15', outstandingMinorUnits: 30_000 },
    { dueOn: '2026-04-15', outstandingMinorUnits: 30_000 },
  ];

  it('ages from the oldest unpaid instalment', () => {
    const arrears = ageArrears(rows, '2026-03-01', USD);
    expect(arrears?.missedInstalments).toBe(2);
    expect(arrears?.amount.minorUnits).toBe(60_000);
    expect(arrears?.daysPastDue).toBe(45);
    expect(arrears?.bucket).toBe('30_59');
  });

  it('reports nothing when no instalment is yet past due', () => {
    expect(ageArrears(rows, '2026-01-01', USD)).toBeNull();
    expect(ageArrears([{ dueOn: '2026-01-15', outstandingMinorUnits: 0 }], '2026-06-01', USD))
      .toBeNull();
  });

  it('places each delinquency in its standard band', () => {
    const bands: [number, string][] = [
      [0, 'current'],
      [1, '1_29'],
      [29, '1_29'],
      [30, '30_59'],
      [59, '30_59'],
      [60, '60_89'],
      [89, '60_89'],
      [90, '90_plus'],
      [400, '90_plus'],
    ];
    for (const [days, bucket] of bands) {
      expect(bucketFor(days)).toBe(bucket);
    }
  });
});

describe('payoff', () => {
  it('accrues ACT/365 on the outstanding principal only', () => {
    // 1,000,000c × 12% × 365/365 = 120,000c
    expect(accrueInterest(usd(1_000_000), 12, 365).minorUnits).toBe(120_000);
    expect(accrueInterest(usd(1_000_000), 12, 0).minorUnits).toBe(0);
    expect(accrueInterest(zero(USD), 12, 90).minorUnits).toBe(0);
  });

  it('totals to exactly principal + interest + fee, so the customer can check it', () => {
    const quote = buildPayoffQuote({
      loanId: '01JZZZZZZZZZZZZZZZZZZZZZZZ',
      asOf: '2026-06-01',
      outstandingPrincipal: usd(500_000),
      accruedInterest: usd(4_000),
      outstandingFees: usd(1_000),
      earlyRepaymentFeePercent: 1,
      remainingScheduledInterest: usd(60_000),
      validUntil: DRAWDOWN,
    });

    expect(quote.earlyRepaymentFee.minorUnits).toBe(6_000);
    expect(quote.totalPayoff.minorUnits).toBe(
      quote.outstandingPrincipal.minorUnits +
        quote.accruedInterest.minorUnits +
        quote.earlyRepaymentFee.minorUnits,
    );
    expect(quote.savingsVersusTerm.minorUnits).toBe(50_000);
  });

  it('never advertises a negative saving', () => {
    const quote = buildPayoffQuote({
      loanId: '01JZZZZZZZZZZZZZZZZZZZZZZZ',
      asOf: '2026-06-01',
      outstandingPrincipal: usd(500_000),
      accruedInterest: usd(4_000),
      outstandingFees: zero(USD),
      earlyRepaymentFeePercent: 5,
      remainingScheduledInterest: usd(5_000),
      validUntil: DRAWDOWN,
    });
    expect(quote.savingsVersusTerm.minorUnits).toBe(0);
  });
});

describe('affordability', () => {
  it('caps the instalment at a share of income, net of existing commitments', () => {
    expect(maximumMonthlyInstalment(usd(800_000), usd(50_000)).minorUnits).toBe(270_000);
    expect(maximumMonthlyInstalment(usd(100_000), usd(90_000)).minorUnits).toBe(0);
  });

  it('turns a monthly capacity into the principal it supports', () => {
    const principal = affordablePrincipal({
      maximumMonthlyInstalment: usd(50_000),
      annualRatePercent: 0,
      termMonths: 24,
      frequency: 'monthly',
    });
    expect(principal.minorUnits).toBe(1_200_000);
  });
});
