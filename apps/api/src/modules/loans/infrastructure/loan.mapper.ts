import type {
  Loan,
  LoanArrears,
  LoanDetail,
  LoanStatus,
  RepaymentFrequency,
  RepaymentInstalment,
} from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { AgeableInstalment } from '../domain/arrears.js';
import type { InstalmentSub, LoanDoc } from './loan.schemas.js';

/**
 * Persistence → contract for booked loans.
 *
 * Derived figures (what is next, how much of the schedule is behind you) are computed here rather
 * than stored, so they cannot drift away from the schedule they describe.
 */

/** What is still owed against one scheduled instalment. Never negative. */
export function outstandingOn(instalment: InstalmentSub): number {
  return Math.max(0, instalment.instalmentMinorUnits - instalment.paidMinorUnits);
}

export function toAgeable(schedule: readonly InstalmentSub[]): AgeableInstalment[] {
  return schedule.map((instalment) => ({
    dueOn: instalment.dueOn,
    outstandingMinorUnits: outstandingOn(instalment),
  }));
}

export function toInstalment(
  instalment: InstalmentSub,
  currency: string,
): RepaymentInstalment {
  return {
    number: instalment.number,
    dueOn: instalment.dueOn,
    instalment: toMoneyDto(instalment.instalmentMinorUnits, currency),
    principal: toMoneyDto(instalment.principalMinorUnits, currency),
    interest: toMoneyDto(instalment.interestMinorUnits, currency),
    fees: toMoneyDto(instalment.feesMinorUnits, currency),
    openingBalance: toMoneyDto(instalment.openingBalanceMinorUnits, currency),
    closingBalance: toMoneyDto(instalment.closingBalanceMinorUnits, currency),
    status: instalment.status as RepaymentInstalment['status'],
    paidAt: instalment.paidAt?.toISOString() ?? null,
    paidAmount:
      instalment.paidMinorUnits > 0 ? toMoneyDto(instalment.paidMinorUnits, currency) : null,
  };
}

function nextDue(schedule: readonly InstalmentSub[]): InstalmentSub | undefined {
  return schedule.find((instalment) => outstandingOn(instalment) > 0);
}

/** Principal + accrued interest + unpaid charges: everything the customer owes right now. */
export function totalOutstandingMinorUnits(loan: LoanDoc): number {
  return (
    loan.outstandingPrincipalMinorUnits +
    loan.accruedInterestMinorUnits +
    loan.feesOutstandingMinorUnits
  );
}

export function toLoan(loan: LoanDoc, arrears: LoanArrears | null): Loan {
  const currency = loan.currency;
  const next = nextDue(loan.schedule);
  const settled = loan.schedule.filter((instalment) => outstandingOn(instalment) === 0).length;

  return {
    id: loan._id,
    reference: loan.reference,
    accountId: loan.accountId,
    customerId: loan.customerId,
    productCode: loan.productCode,
    productName: loan.productName,
    status: loan.status as LoanStatus,
    principal: toMoneyDto(loan.principalMinorUnits, currency),
    outstandingPrincipal: toMoneyDto(loan.outstandingPrincipalMinorUnits, currency),
    outstandingInterest: toMoneyDto(loan.accruedInterestMinorUnits, currency),
    totalOutstanding: toMoneyDto(totalOutstandingMinorUnits(loan), currency),
    rate: loan.rate,
    termMonths: loan.termMonths,
    frequency: loan.frequency as RepaymentFrequency,
    instalment: toMoneyDto(loan.instalmentMinorUnits, currency),
    nextPaymentOn: next?.dueOn ?? null,
    nextPaymentAmount: next ? toMoneyDto(outstandingOn(next), currency) : null,
    paidInstalments: settled,
    remainingInstalments: loan.schedule.length - settled,
    arrears,
    disbursedAt: loan.disbursedAt?.toISOString() ?? null,
    maturesOn: loan.maturesOn,
    settledAt: loan.settledAt?.toISOString() ?? null,
  };
}

export function toLoanDetail(loan: LoanDoc, arrears: LoanArrears | null): LoanDetail {
  return {
    ...toLoan(loan, arrears),
    schedule: loan.schedule.map((instalment) => toInstalment(instalment, loan.currency)),
    repaymentAccountId: loan.repaymentAccountId,
  };
}
