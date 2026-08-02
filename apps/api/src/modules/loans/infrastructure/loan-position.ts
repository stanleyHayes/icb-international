import { add, fromMinorUnits, sum, type CurrencyCode, type Money } from '@icb/money';

import { ageArrears } from '../domain/arrears.js';
import { accrueInterest, earlyRepaymentFee } from '../domain/payoff.js';
import type { RepaymentAllocation, OutstandingBalances } from '../domain/repayment-allocation.js';
import { daysBetweenIso } from '../domain/schedule-dates.js';
import { outstandingOn, toAgeable } from './loan.mapper.js';
import type { LoanDoc } from './loan.schemas.js';
import { ageSchedule, applyPaymentToSchedule, markAllPaid } from './schedule.builder.js';

/**
 * Where a loan stands, and what a payment does to it.
 *
 * Kept apart from the service so the arithmetic of servicing can be read — and reasoned about —
 * without the transaction plumbing around it. Nothing here reads a clock: the caller supplies
 * both "today" and "now", which is what makes an operator's time travel visible in the numbers.
 */

export interface LoanPosition {
  readonly outstanding: OutstandingBalances;
  /** Interest the customer would still pay by running the schedule to term. */
  readonly remainingScheduledInterest: Money;
}

/** Bring interest up to `today` and total everything the loan currently owes. */
export function positionAt(loan: LoanDoc, today: string): LoanPosition {
  const currency = loan.currency as CurrencyCode;
  const principal = fromMinorUnits(loan.outstandingPrincipalMinorUnits, currency);
  const elapsed = loan.lastAccrualOn ? Math.max(0, daysBetweenIso(loan.lastAccrualOn, today)) : 0;

  return {
    outstanding: {
      fees: fromMinorUnits(loan.feesOutstandingMinorUnits, currency),
      interest: add(
        fromMinorUnits(loan.accruedInterestMinorUnits, currency),
        accrueInterest(principal, loan.rate, elapsed),
      ),
      principal,
    },
    remainingScheduledInterest: sum(
      loan.schedule
        .filter((instalment) => outstandingOn(instalment) > 0)
        .map((instalment) => fromMinorUnits(instalment.interestMinorUnits, currency)),
      currency,
    ),
  };
}

/** A settlement raises the early-repayment charge; an ordinary repayment does not. */
export function outstandingFor(
  loan: LoanDoc,
  today: string,
  settling: boolean,
  earlyRepaymentFeePercent: number,
): OutstandingBalances {
  const { outstanding } = positionAt(loan, today);
  if (!settling) {
    return outstanding;
  }
  return {
    ...outstanding,
    fees: earlyRepaymentFee(outstanding.principal, outstanding.fees, earlyRepaymentFeePercent),
  };
}

function statusAfter(settled: boolean, inArrears: boolean): string {
  if (settled) return 'settled';
  return inArrears ? 'in_arrears' : 'active';
}

export interface ServicingInput {
  readonly loan: LoanDoc;
  readonly allocation: RepaymentAllocation;
  readonly outstanding: OutstandingBalances;
  readonly today: string;
  readonly now: Date;
}

/**
 * The servicing state a posting justifies.
 *
 * Every counter is *decremented by the amount the posting moved* rather than reassigned from a
 * recomputed total, so the loan's books and the ledger's cannot drift apart.
 */
export function servicingPatch(input: ServicingInput): Partial<LoanDoc> {
  const { loan, allocation, outstanding, today, now } = input;
  const principalLeft = loan.outstandingPrincipalMinorUnits - allocation.principal.minorUnits;
  const settled = principalLeft <= 0;

  const paid = applyPaymentToSchedule(loan.schedule, allocation.applied.minorUnits, now);
  const schedule = ageSchedule(settled ? markAllPaid(paid, now) : paid, today);
  const arrears = ageArrears(toAgeable(schedule), today, loan.currency as CurrencyCode);

  return {
    outstandingPrincipalMinorUnits: Math.max(0, principalLeft),
    accruedInterestMinorUnits: outstanding.interest.minorUnits - allocation.interest.minorUnits,
    feesOutstandingMinorUnits: outstanding.fees.minorUnits - allocation.fees.minorUnits,
    schedule,
    lastAccrualOn: today,
    status: statusAfter(settled, arrears !== null),
    settledAt: settled ? now : loan.settledAt,
    updatedAt: now,
  };
}
