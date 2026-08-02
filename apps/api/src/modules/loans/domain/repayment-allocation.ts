import { add, max, min, subtract, zero, type Money } from '@icb/money';

import { ValidationError } from '../../../common/errors/index.js';

/**
 * Repayment allocation.
 *
 * The waterfall is fees → interest → principal, in that order and no other. The order is not a
 * preference: paying principal ahead of accrued interest would let a loan's interest balance grow
 * while its statement showed progress, and a customer who paid every instalment on time would
 * still owe money at maturity.
 *
 * Anything left once all three are satisfied is returned as `unallocated` rather than being
 * quietly absorbed — an overpayment is the caller's problem to refuse or refund, not this
 * function's to hide.
 */

export interface OutstandingBalances {
  readonly fees: Money;
  readonly interest: Money;
  readonly principal: Money;
}

export interface RepaymentAllocation {
  readonly fees: Money;
  readonly interest: Money;
  readonly principal: Money;
  /** Fees + interest + principal — what the posting actually moves. */
  readonly applied: Money;
  readonly unallocated: Money;
}

function nonNegative(amount: Money): Money {
  return max(amount, zero(amount.currency));
}

export function totalOutstanding(outstanding: OutstandingBalances): Money {
  return add(add(nonNegative(outstanding.fees), nonNegative(outstanding.interest)), nonNegative(outstanding.principal));
}

export function allocateRepayment(
  amount: Money,
  outstanding: OutstandingBalances,
): RepaymentAllocation {
  if (amount.minorUnits <= 0) {
    throw new ValidationError('A repayment must be greater than zero');
  }

  const fees = min(amount, nonNegative(outstanding.fees));
  const afterFees = subtract(amount, fees);

  const interest = min(afterFees, nonNegative(outstanding.interest));
  const afterInterest = subtract(afterFees, interest);

  const principal = min(afterInterest, nonNegative(outstanding.principal));
  const unallocated = subtract(afterInterest, principal);

  return {
    fees,
    interest,
    principal,
    applied: subtract(amount, unallocated),
    unallocated,
  };
}
