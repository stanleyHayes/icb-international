import { describe, expect, it } from 'vitest';

import {
  evaluateEligibility,
  type CustomerFacts,
  type EligibilityRules,
} from '../eligibility.js';

function rules(overrides: Partial<EligibilityRules> = {}): EligibilityRules {
  return {
    minimumAge: null,
    minimumKycLevel: null,
    residentsOnly: false,
    businessOnly: false,
    ...overrides,
  };
}

function facts(overrides: Partial<CustomerFacts> = {}): CustomerFacts {
  return {
    ageYears: 30,
    kycLevel: 'tier_2',
    resident: true,
    customerType: 'individual',
    ...overrides,
  };
}

describe('evaluateEligibility', () => {
  it('passes when no rules constrain anything', () => {
    const result = evaluateEligibility(rules(), facts());
    expect(result).toEqual({ eligible: true, failures: [] });
  });

  it('fails an under-age applicant', () => {
    const result = evaluateEligibility(rules({ minimumAge: 18 }), facts({ ageYears: 17 }));
    expect(result.eligible).toBe(false);
    expect(result.failures.map((failure) => failure.rule)).toEqual(['minimum_age']);
  });

  it('fails an unknown age when a minimum is set — no date of birth, no product', () => {
    const result = evaluateEligibility(rules({ minimumAge: 18 }), facts({ ageYears: null }));
    expect(result.eligible).toBe(false);
  });

  it('passes an applicant exactly at the minimum age', () => {
    const result = evaluateEligibility(rules({ minimumAge: 18 }), facts({ ageYears: 18 }));
    expect(result.eligible).toBe(true);
  });

  it('ranks KYC levels ordinally: tier_2 satisfies a tier_1 requirement', () => {
    const result = evaluateEligibility(rules({ minimumKycLevel: 'tier_1' }), facts());
    expect(result.eligible).toBe(true);
  });

  it('fails a lower tier against a higher requirement', () => {
    const result = evaluateEligibility(
      rules({ minimumKycLevel: 'tier_3' }),
      facts({ kycLevel: 'tier_2' }),
    );
    expect(result.failures.map((failure) => failure.rule)).toEqual(['kyc_level']);
  });

  it('treats an unverified customer as below every tier', () => {
    const result = evaluateEligibility(
      rules({ minimumKycLevel: 'tier_1' }),
      facts({ kycLevel: null }),
    );
    expect(result.eligible).toBe(false);
  });

  it('fails closed on a KYC requirement the engine does not know', () => {
    const result = evaluateEligibility(rules({ minimumKycLevel: 'tier_99' }), facts());
    expect(result.eligible).toBe(false);
  });

  it('enforces residents-only', () => {
    const result = evaluateEligibility(rules({ residentsOnly: true }), facts({ resident: false }));
    expect(result.failures.map((failure) => failure.rule)).toEqual(['residency']);
  });

  it('enforces business-only', () => {
    const result = evaluateEligibility(rules({ businessOnly: true }), facts());
    expect(result.failures.map((failure) => failure.rule)).toEqual(['customer_type']);
  });

  it('passes a business customer on a business-only product', () => {
    const result = evaluateEligibility(
      rules({ businessOnly: true }),
      facts({ customerType: 'business' }),
    );
    expect(result.eligible).toBe(true);
  });

  it('reports every failure at once, not just the first', () => {
    const result = evaluateEligibility(
      rules({ minimumAge: 25, minimumKycLevel: 'tier_3', businessOnly: true }),
      facts({ ageYears: 20, kycLevel: 'tier_1' }),
    );
    expect(result.failures.map((failure) => failure.rule)).toEqual([
      'minimum_age',
      'kyc_level',
      'customer_type',
    ]);
  });
});
