import type { PayoffQuote } from '@icb/contracts';
import { add, max, multiply, percentage, subtract, zero, type Money } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';

/**
 * Settling early.
 *
 * Interest accrues on the outstanding principal only, ACT/365 simple — so a customer who settles
 * halfway through a term pays for the days they actually held the money and no more. The early
 * repayment charge is the product's stated percentage of the principal being settled, and it is
 * quoted separately from the interest so the customer can see exactly what the option costs.
 */

const DAYS_PER_YEAR = 365;
const PERCENT = 100;

/** ACT/365 simple interest on a principal held for `days` days. */
export function accrueInterest(principal: Money, annualRatePercent: number, days: number): Money {
  if (days <= 0 || principal.minorUnits <= 0 || annualRatePercent <= 0) {
    return zero(principal.currency);
  }
  return multiply(principal, (annualRatePercent / PERCENT) * (days / DAYS_PER_YEAR));
}

export interface PayoffInput {
  readonly loanId: string;
  readonly asOf: string;
  readonly outstandingPrincipal: Money;
  readonly accruedInterest: Money;
  /** Charges already raised on the loan and not yet paid. Settled alongside the exit charge. */
  readonly outstandingFees: Money;
  readonly earlyRepaymentFeePercent: number;
  /** Interest the customer would still pay by running the schedule to term. */
  readonly remainingScheduledInterest: Money;
  readonly validUntil: Date;
}

/**
 * The exit charge: the product's early-repayment percentage plus anything already owed in fees.
 * Bundling them keeps `principal + interest + fee === totalPayoff` exactly true, so the customer
 * can check the arithmetic themselves.
 */
export function earlyRepaymentFee(input: PayoffInput): Money {
  const charge = percentage(input.outstandingPrincipal, input.earlyRepaymentFeePercent);
  return add(charge, max(input.outstandingFees, zero(input.outstandingFees.currency)));
}

export function buildPayoffQuote(input: PayoffInput): PayoffQuote {
  const currency = input.outstandingPrincipal.currency;
  const fee = earlyRepaymentFee(input);
  const total = add(add(input.outstandingPrincipal, input.accruedInterest), fee);
  const avoided = subtract(input.remainingScheduledInterest, input.accruedInterest);
  const savings = max(subtract(avoided, fee), zero(currency));

  return {
    loanId: input.loanId,
    asOf: input.asOf,
    outstandingPrincipal: toMoneyDto(input.outstandingPrincipal.minorUnits, currency),
    accruedInterest: toMoneyDto(input.accruedInterest.minorUnits, currency),
    earlyRepaymentFee: toMoneyDto(fee.minorUnits, currency),
    totalPayoff: toMoneyDto(total.minorUnits, currency),
    savingsVersusTerm: toMoneyDto(savings.minorUnits, currency),
    validUntil: input.validUntil.toISOString(),
  };
}
