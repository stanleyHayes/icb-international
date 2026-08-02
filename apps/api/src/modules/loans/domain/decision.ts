import type { LoanDecision, LoanProduct } from '@icb/contracts';
import { format, isGreaterThan, isLessThan, min, type Money } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { amountBand } from './loan-products.js';
import { scoredRate } from './pricing.js';
import type { ScorecardResult } from './scorecard.js';

/**
 * Turning a score into a decision.
 *
 * Policy rules run *before* the score, not after it. An application that fails affordability is
 * declined regardless of how well it scores elsewhere, because a score is a summary and a rule is
 * a promise. Every rule that fires contributes a sentence a human can read and act on.
 */

const APPROVE_FLOOR = 700;
const REFER_FLOOR = 560;
/** Repayments above this share of declared income are declined outright. */
const MAX_DEBT_SERVICE_RATIO = 0.55;
/** Borrowing above this multiple of annual income always reaches an underwriter. */
const REFERRAL_LOAN_TO_INCOME = 2.5;
const PERCENT = 100;

export interface DecisionInput {
  readonly scorecard: ScorecardResult;
  readonly product: LoanProduct;
  readonly requestedAmount: Money;
  readonly termMonths: number;
  /** The largest principal the applicant's surplus supports at the quoted term and rate. */
  readonly maximumAffordable: Money;
  readonly arrearsCount: number;
  readonly kycVerified: boolean;
  readonly decidedBy: string;
  readonly decidedAt: Date;
}

type RuleCheck = (input: DecisionInput) => string | null;

function outsideAmountBand(input: DecisionInput): string | null {
  const band = amountBand(input.product);
  if (isLessThan(input.requestedAmount, band.minimum)) {
    return `The smallest ${input.product.name} we offer is ${format(band.minimum)}`;
  }
  if (isGreaterThan(input.requestedAmount, band.maximum)) {
    return `The largest ${input.product.name} we offer is ${format(band.maximum)}`;
  }
  return null;
}

function outsideTermBand(input: DecisionInput): string | null {
  const { minimumTermMonths, maximumTermMonths, name } = input.product;
  if (input.termMonths < minimumTermMonths || input.termMonths > maximumTermMonths) {
    return `A ${name} runs for ${minimumTermMonths} to ${maximumTermMonths} months`;
  }
  return null;
}

function unaffordable(input: DecisionInput): string | null {
  const ratio = input.scorecard.debtServiceRatio;
  if (ratio <= MAX_DEBT_SERVICE_RATIO) {
    return null;
  }
  const shown = Number.isFinite(ratio) ? `${(ratio * PERCENT).toFixed(0)}%` : 'all';
  const limit = MAX_DEBT_SERVICE_RATIO * PERCENT;
  return `Repayments would take ${shown} of declared monthly income, above our ${limit}% limit`;
}

function noHeadroom(input: DecisionInput): string | null {
  return input.scorecard.monthlySurplusMinorUnits < 0
    ? 'Declared income does not cover existing outgoings alongside this repayment'
    : null;
}

function noAffordableAmount(input: DecisionInput): string | null {
  return input.maximumAffordable.minorUnits <= 0
    ? 'Existing commitments already use the share of income we are able to lend against'
    : null;
}

function identityIncomplete(input: DecisionInput): string | null {
  return input.kycVerified ? null : 'Identity verification must be completed before drawdown';
}

function existingArrears(input: DecisionInput): string | null {
  return input.arrearsCount > 0
    ? `${input.arrearsCount} existing loan(s) in arrears need an underwriter's review`
    : null;
}

function highLoanToIncome(input: DecisionInput): string | null {
  return input.scorecard.loanToIncome > REFERRAL_LOAN_TO_INCOME
    ? `Requesting more than ${REFERRAL_LOAN_TO_INCOME}× declared annual income`
    : null;
}

const HARD_DECLINES: readonly RuleCheck[] = [
  outsideAmountBand,
  outsideTermBand,
  unaffordable,
  noHeadroom,
  noAffordableAmount,
];

const REFERRALS: readonly RuleCheck[] = [identityIncomplete, existingArrears, highLoanToIncome];

function collect(rules: readonly RuleCheck[], input: DecisionInput): string[] {
  return rules.map((rule) => rule(input)).filter((reason): reason is string => reason !== null);
}

function outcomeFor(score: number, referred: boolean): LoanDecision['outcome'] {
  if (score < REFER_FLOOR) return 'declined';
  if (referred || score < APPROVE_FLOOR) return 'referred';
  return 'approved';
}

function reasonsFor(input: DecisionInput, outcome: LoanDecision['outcome'], referrals: string[]) {
  const { score, band } = input.scorecard;
  if (outcome === 'approved') {
    return [`Scored ${score}/1000 (${band}) against our lending policy`];
  }
  if (outcome === 'referred') {
    return referrals.length > 0
      ? referrals
      : [`Scored ${score}/1000 (${band}) — just below automatic approval, so a human will look`];
  }
  return [`Scored ${score}/1000 (${band}), below the minimum of ${REFER_FLOOR} for this product`];
}

/** Apply policy, then the score, and record both the answer and the reasoning. */
export function decide(input: DecisionInput): LoanDecision {
  const declines = collect(HARD_DECLINES, input);
  const declined = declines.length > 0;
  const referrals = declined ? [] : collect(REFERRALS, input);
  const outcome = declined
    ? 'declined'
    : outcomeFor(input.scorecard.score, referrals.length > 0);
  const approved = outcome === 'approved';
  const amount = min(input.requestedAmount, input.maximumAffordable);

  return {
    outcome,
    score: input.scorecard.score,
    band: input.scorecard.band,
    factors: input.scorecard.factors,
    approvedAmount: approved ? toMoneyDto(amount.minorUnits, amount.currency) : null,
    approvedRate: approved ? scoredRate(input.product, input.scorecard.score) : null,
    reasons: declined ? declines : reasonsFor(input, outcome, referrals),
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt.toISOString(),
  };
}
