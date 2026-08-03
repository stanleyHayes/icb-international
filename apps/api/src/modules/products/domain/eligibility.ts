import { KYC_LEVELS, type CustomerType, type KycLevel } from '@icb/contracts';

/**
 * Product eligibility rules engine.
 *
 * Evaluation never throws: a customer either qualifies or is handed back the full list of
 * reasons they do not, so the client can show "you need X, Y" instead of failing one rule at a
 * time. KYC levels are ordered (tier_1 < tier_2 < tier_3), and an unverified customer (`null`)
 * ranks below every tier.
 */

export const ELIGIBILITY_RULES = ['minimum_age', 'kyc_level', 'residency', 'customer_type'] as const;
export type EligibilityRule = (typeof ELIGIBILITY_RULES)[number];

export interface EligibilityRules {
  readonly minimumAge: number | null;
  readonly minimumKycLevel: string | null;
  readonly residentsOnly: boolean;
  readonly businessOnly: boolean;
}

export interface CustomerFacts {
  readonly ageYears: number | null;
  readonly kycLevel: KycLevel | null;
  readonly resident: boolean;
  readonly customerType: CustomerType;
}

export interface EligibilityFailure {
  readonly rule: EligibilityRule;
  readonly message: string;
}

export interface EligibilityResult {
  readonly eligible: boolean;
  readonly failures: readonly EligibilityFailure[];
}

export function evaluateEligibility(
  rules: EligibilityRules,
  facts: CustomerFacts,
): EligibilityResult {
  const checks = [checkAge, checkKycLevel, checkResidency, checkCustomerType];
  const failures = checks.flatMap((check) => {
    const failure = check(rules, facts);
    return failure === null ? [] : [failure];
  });
  return { eligible: failures.length === 0, failures };
}

function checkAge(rules: EligibilityRules, facts: CustomerFacts): EligibilityFailure | null {
  if (rules.minimumAge === null) {
    return null;
  }
  const tooYoung = facts.ageYears === null || facts.ageYears < rules.minimumAge;
  return tooYoung
    ? { rule: 'minimum_age', message: `You must be at least ${rules.minimumAge} years old` }
    : null;
}

function checkKycLevel(rules: EligibilityRules, facts: CustomerFacts): EligibilityFailure | null {
  if (rules.minimumKycLevel === null) {
    return null;
  }
  return kycSatisfies(rules.minimumKycLevel, facts.kycLevel)
    ? null
    : { rule: 'kyc_level', message: `This product requires ${rules.minimumKycLevel} verification` };
}

function checkResidency(rules: EligibilityRules, facts: CustomerFacts): EligibilityFailure | null {
  return rules.residentsOnly && !facts.resident
    ? { rule: 'residency', message: 'This product is available to residents only' }
    : null;
}

function checkCustomerType(
  rules: EligibilityRules,
  facts: CustomerFacts,
): EligibilityFailure | null {
  return rules.businessOnly && facts.customerType !== 'business'
    ? { rule: 'customer_type', message: 'This product is available to business customers only' }
    : null;
}

/** Unknown required levels fail closed: a rule the engine cannot read can never be satisfied. */
function kycSatisfies(required: string, actual: KycLevel | null): boolean {
  const requiredIndex = KYC_LEVELS.indexOf(required as KycLevel);
  if (requiredIndex === -1) {
    return false;
  }
  const actualIndex = actual === null ? -1 : KYC_LEVELS.indexOf(actual);
  return actualIndex >= requiredIndex;
}
