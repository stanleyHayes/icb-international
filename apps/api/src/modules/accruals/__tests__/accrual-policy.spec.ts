import { describe, expect, it } from 'vitest';

import { policyFor } from '../domain/accrual-policy.js';

describe('policyFor', () => {
  it('prices current accounts ACT/360 with monthly capitalisation', () => {
    const policy = policyFor('current', 'USD', null);
    expect(policy?.basis).toBe('ACT/360');
    expect(policy?.capitalisation).toBe('monthly');
  });

  it('prices savings ACT/365 on tiered bands, converted to minor units', () => {
    const policy = policyFor('savings', 'USD', null);
    expect(policy?.basis).toBe('ACT/365');
    expect(policy?.bands).toEqual([
      { fromMinorUnits: 0, rate: 0.02 },
      { fromMinorUnits: 500_000, rate: 0.024 },
      { fromMinorUnits: 5_000_000, rate: 0.028 },
    ]);
  });

  it('converts band thresholds for a zero-decimal currency', () => {
    const policy = policyFor('savings', 'JPY', null);
    expect(policy?.bands[1]).toEqual({ fromMinorUnits: 5_000, rate: 0.024 });
  });

  it('never capitalises fixed deposits — the deposits lifecycle posts at maturity', () => {
    expect(policyFor('fixed_deposit', 'USD', null)?.capitalisation).toBe('at_maturity');
  });

  it('replaces the tier card with a flat band when the account carries its own rate', () => {
    const policy = policyFor('savings', 'USD', 0.045);
    expect(policy?.bands).toEqual([{ fromMinorUnits: 0, rate: 0.045 }]);
  });

  it('ignores a non-positive override and falls back to the card', () => {
    expect(policyFor('savings', 'USD', 0)?.bands.length).toBe(3);
  });

  it('returns null for kinds that do not bear interest', () => {
    expect(policyFor('loan', 'USD', null)).toBeNull();
    expect(policyFor('unknown', 'USD', null)).toBeNull();
  });
});
