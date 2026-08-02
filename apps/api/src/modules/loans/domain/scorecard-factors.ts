import type { CustomerTier, KycLevel, ScorecardFactor } from '@icb/contracts';
import { add, format, subtract, type Money } from '@icb/money';

/**
 * The individual scorecard factors.
 *
 * Every factor is a pure function of the application and returns *why* it scored the way it did.
 * A decline nobody can explain is a decline nobody can appeal, audit, or fix — so the explanation
 * is produced by the same code that produces the number, not written afterwards by hand.
 *
 * Weights are points out of a 1000-point card and sum to exactly `TOTAL_WEIGHT`.
 */

export interface ScorecardInput {
  readonly monthlyIncome: Money;
  readonly monthlyExpenses: Money;
  readonly existingCommitments: Money;
  readonly requestedAmount: Money;
  /** The monthly-equivalent repayment the applicant would take on. */
  readonly instalment: Money;
  readonly termMonths: number;
  readonly tier: CustomerTier;
  readonly kycLevel: KycLevel | null;
  /** How many of the applicant's existing loans are currently in arrears. */
  readonly arrearsCount: number;
}

export const TOTAL_WEIGHT = 1000;

const WEIGHTS = {
  disposableIncome: 250,
  debtServiceRatio: 250,
  loanToIncome: 150,
  term: 100,
  relationship: 100,
  identity: 100,
  arrears: 50,
} as const;

/** A surplus of this share of income after the new repayment earns full marks. */
const TARGET_SURPLUS_RATIO = 0.35;
/** Repayments at or above this share of income earn nothing. */
const MAX_DEBT_SERVICE_RATIO = 0.5;
/** Borrowing this multiple of annual income earns nothing. */
const MAX_LOAN_TO_INCOME = 3;
const SCORED_TERM_FLOOR_MONTHS = 12;
const SCORED_TERM_CEILING_MONTHS = 120;
const MONTHS_PER_YEAR = 12;
const PERCENT = 100;

const TIER_STRENGTH: Readonly<Record<CustomerTier, number>> = {
  standard: 0.55,
  plus: 0.7,
  premier: 0.85,
  private: 1,
};

const KYC_STRENGTH: Readonly<Record<KycLevel, number>> = {
  tier_1: 0.4,
  tier_2: 0.75,
  tier_3: 1,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function build(
  code: string,
  label: string,
  weight: number,
  ratio: number,
  detail: string,
): ScorecardFactor {
  return { code, label, weight, contribution: Math.round(weight * clamp01(ratio)), detail };
}

function money(value: Money): string {
  return format(value);
}

/** Monthly income left over once expenses, existing commitments and the new repayment are met. */
export function monthlySurplus(input: ScorecardInput): Money {
  const outgoings = add(add(input.monthlyExpenses, input.existingCommitments), input.instalment);
  return subtract(input.monthlyIncome, outgoings);
}

/** Share of gross monthly income consumed by all credit repayments, new and existing. */
export function debtServiceRatio(input: ScorecardInput): number {
  const income = input.monthlyIncome.minorUnits;
  if (income <= 0) return Number.POSITIVE_INFINITY;
  return (input.instalment.minorUnits + input.existingCommitments.minorUnits) / income;
}

/** Requested borrowing as a multiple of declared annual income. */
export function loanToIncome(input: ScorecardInput): number {
  const annualIncome = input.monthlyIncome.minorUnits * MONTHS_PER_YEAR;
  if (annualIncome <= 0) return Number.POSITIVE_INFINITY;
  return input.requestedAmount.minorUnits / annualIncome;
}

function disposableIncomeFactor(input: ScorecardInput): ScorecardFactor {
  const surplus = monthlySurplus(input);
  const income = input.monthlyIncome.minorUnits;
  const ratio = income <= 0 ? 0 : surplus.minorUnits / income / TARGET_SURPLUS_RATIO;
  return build(
    'disposable_income',
    'Disposable income',
    WEIGHTS.disposableIncome,
    ratio,
    `${money(surplus)} left each month after expenses, existing commitments and this repayment`,
  );
}

function debtServiceFactor(input: ScorecardInput): ScorecardFactor {
  const ratio = debtServiceRatio(input);
  const scored = (MAX_DEBT_SERVICE_RATIO - ratio) / MAX_DEBT_SERVICE_RATIO;
  const percent = Number.isFinite(ratio) ? (ratio * PERCENT).toFixed(1) : '∞';
  return build(
    'debt_service_ratio',
    'Debt service ratio',
    WEIGHTS.debtServiceRatio,
    scored,
    `Credit repayments would take ${percent}% of declared monthly income`,
  );
}

function loanToIncomeFactor(input: ScorecardInput): ScorecardFactor {
  const multiple = loanToIncome(input);
  const scored = (MAX_LOAN_TO_INCOME - multiple) / MAX_LOAN_TO_INCOME;
  const rendered = Number.isFinite(multiple) ? `${multiple.toFixed(2)}×` : 'more than 3×';
  return build(
    'loan_to_income',
    'Loan to income',
    WEIGHTS.loanToIncome,
    scored,
    `Requesting ${rendered} declared annual income`,
  );
}

function termFactor(input: ScorecardInput): ScorecardFactor {
  const span = SCORED_TERM_CEILING_MONTHS - SCORED_TERM_FLOOR_MONTHS;
  const ratio = (SCORED_TERM_CEILING_MONTHS - input.termMonths) / span;
  return build(
    'term',
    'Repayment term',
    WEIGHTS.term,
    ratio,
    `${input.termMonths}-month term — a longer term carries more exposure to change`,
  );
}

function relationshipFactor(input: ScorecardInput): ScorecardFactor {
  return build(
    'relationship_tier',
    'Relationship tier',
    WEIGHTS.relationship,
    TIER_STRENGTH[input.tier],
    `Held as a ${input.tier.replace('_', ' ')} customer`,
  );
}

function identityFactor(input: ScorecardInput): ScorecardFactor {
  const level = input.kycLevel;
  return build(
    'kyc_level',
    'Identity verification',
    WEIGHTS.identity,
    level === null ? 0 : KYC_STRENGTH[level],
    level === null ? 'Identity has not been verified' : `Verified to ${level.replace('_', ' ')}`,
  );
}

function arrearsFactor(input: ScorecardInput): ScorecardFactor {
  const count = input.arrearsCount;
  const strengths = [1, 0.4];
  return build(
    'existing_arrears',
    'Existing arrears',
    WEIGHTS.arrears,
    strengths[count] ?? 0,
    count === 0 ? 'No existing borrowing in arrears' : `${count} existing loan(s) in arrears`,
  );
}

const CALCULATORS: readonly ((input: ScorecardInput) => ScorecardFactor)[] = [
  disposableIncomeFactor,
  debtServiceFactor,
  loanToIncomeFactor,
  termFactor,
  relationshipFactor,
  identityFactor,
  arrearsFactor,
];

export function scoreFactors(input: ScorecardInput): ScorecardFactor[] {
  return CALCULATORS.map((calculate) => calculate(input));
}
