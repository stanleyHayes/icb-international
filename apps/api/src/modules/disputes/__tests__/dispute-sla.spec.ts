import { DISPUTE_REASONS, type DisputeReason } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import {
  qualifiesForProvisionalCredit,
  slaBusinessDaysFor,
} from '../../risk/domain/dispute-sla.js';

/**
 * SLA computation and provisional-credit eligibility per reason code (implementation lives in
 * the risk module; these tests pin the numbers the staff queue sorts on).
 */
const EXPECTED_SLA_DAYS: Readonly<Record<DisputeReason, number>> = {
  unauthorised: 10,
  atm_no_cash: 10,
  duplicate_charge: 15,
  incorrect_amount: 15,
  credit_not_processed: 20,
  cancelled_recurring: 20,
  goods_not_received: 30,
  goods_not_as_described: 30,
  other: 20,
};

const CREDIT_ELIGIBLE: readonly DisputeReason[] = [
  'unauthorised',
  'duplicate_charge',
  'incorrect_amount',
  'atm_no_cash',
  'cancelled_recurring',
];

describe('slaBusinessDaysFor', () => {
  it('has a deadline for every reason code in the contract', () => {
    expect(Object.keys(EXPECTED_SLA_DAYS).sort((a, b) => a.localeCompare(b))).toEqual(
      [...DISPUTE_REASONS].sort((a, b) => a.localeCompare(b)),
    );
  });

  it.each(DISPUTE_REASONS)('gives %s its contractual deadline', (reason) => {
    expect(slaBusinessDaysFor(reason)).toBe(EXPECTED_SLA_DAYS[reason]);
  });

  it('runs unauthorised claims to the tightest clock', () => {
    const tightest = Math.min(...DISPUTE_REASONS.map(slaBusinessDaysFor));
    expect(slaBusinessDaysFor('unauthorised')).toBe(tightest);
  });
});

describe('qualifiesForProvisionalCredit', () => {
  it.each(DISPUTE_REASONS)('%s eligibility matches policy', (reason) => {
    expect(qualifiesForProvisionalCredit(reason)).toBe(CREDIT_ELIGIBLE.includes(reason));
  });

  it('never auto-credits goods disputes — the merchant must answer first', () => {
    expect(qualifiesForProvisionalCredit('goods_not_received')).toBe(false);
    expect(qualifiesForProvisionalCredit('goods_not_as_described')).toBe(false);
    expect(qualifiesForProvisionalCredit('credit_not_processed')).toBe(false);
  });
});
