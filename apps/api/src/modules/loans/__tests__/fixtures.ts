import type { LoanApplicationRequest } from '@icb/contracts';
import type { ClientSession } from 'mongoose';

import type {
  LoanApplicationDoc,
  StoredOffer,
} from '../infrastructure/loan-application.schemas.js';
import type { InstalmentSub, LoanDoc } from '../infrastructure/loan.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const TODAY = '2026-08-04';

/** Stand-in for the Mongo session the transaction manager hands to the unit of work. */
export const SESSION = { id: 'session-1' } as unknown as ClientSession;

export function instalmentSub(overrides: Partial<InstalmentSub> = {}): InstalmentSub {
  return {
    number: 1,
    dueOn: '2026-09-04',
    instalmentMinorUnits: 23_500,
    principalMinorUnits: 18_500,
    interestMinorUnits: 5_000,
    feesMinorUnits: 0,
    openingBalanceMinorUnits: 500_000,
    closingBalanceMinorUnits: 481_500,
    status: 'scheduled',
    paidAt: null,
    paidMinorUnits: 0,
    ...overrides,
  };
}

/**
 * An active, disbursed £5,000 loan accruing at 9.9%, up to date on interest as at the frozen
 * clock. Disbursement tests override the status/drawdown fields back to a booked-but-undrawn
 * loan; repayment tests use the default as-is.
 */
export function loanDoc(overrides: Partial<LoanDoc> = {}): LoanDoc {
  return {
    _id: 'loan-1',
    reference: 'LN-TESTREF',
    applicationId: 'app-1',
    customerId: 'cust-1',
    accountId: 'acct-1',
    repaymentAccountId: 'acct-1',
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal Loan',
    status: 'active',
    currency: 'USD',
    principalMinorUnits: 500_000,
    outstandingPrincipalMinorUnits: 500_000,
    accruedInterestMinorUnits: 5_000,
    feesOutstandingMinorUnits: 0,
    rate: 9.9,
    termMonths: 24,
    frequency: 'monthly',
    instalmentMinorUnits: 23_500,
    schedule: [instalmentSub()],
    lastAccrualOn: TODAY,
    maturesOn: '2028-08-04',
    disbursedAt: NOW,
    disbursementTransactionId: 'txn-0',
    settledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** A booked-but-undrawn loan: accepted offer, no money moved yet. */
export function approvedLoanDoc(overrides: Partial<LoanDoc> = {}): LoanDoc {
  return loanDoc({
    status: 'approved',
    outstandingPrincipalMinorUnits: 0,
    accruedInterestMinorUnits: 0,
    lastAccrualOn: null,
    disbursedAt: null,
    disbursementTransactionId: null,
    ...overrides,
  });
}

/** A live offer with seven days left to run on the frozen clock, not yet signed. */
export function storedOffer(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    amountMinorUnits: 500_000,
    rate: 9.9,
    instalmentMinorUnits: 23_500,
    expiresAt: new Date(NOW.getTime() + 7 * 86_400_000),
    acceptedAt: null,
    ...overrides,
  };
}

/** The same offer once the customer has accepted it. */
export function acceptedOffer(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return storedOffer({ acceptedAt: NOW, ...overrides });
}

/**
 * A well-formed intake payload for the standard personal loan, priced in the catalogue currency.
 * Both servicing roles default to the same account; the tests that exercise the two-account path
 * override `repaymentAccountId`.
 */
export function applicationRequest(
  overrides: Partial<LoanApplicationRequest> = {},
): LoanApplicationRequest {
  return {
    productCode: 'PERSONAL_STANDARD',
    amount: { minorUnits: 500_000, currency: 'USD', scale: 2 },
    termMonths: 36,
    frequency: 'monthly',
    purpose: 'home_improvement',
    disbursementAccountId: 'acct-1',
    repaymentAccountId: 'acct-1',
    declaredMonthlyIncome: { minorUnits: 300_000, currency: 'USD', scale: 2 },
    declaredMonthlyExpenses: { minorUnits: 120_000, currency: 'USD', scale: 2 },
    existingCommitments: { minorUnits: 20_000, currency: 'USD', scale: 2 },
    ...overrides,
  };
}

export function applicationDoc(
  overrides: Partial<LoanApplicationDoc> = {},
): LoanApplicationDoc {
  return {
    _id: 'app-1',
    reference: 'LNA-TEST',
    customerId: 'cust-1',
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal Loan',
    status: 'accepted',
    requestedMinorUnits: 500_000,
    currency: 'USD',
    termMonths: 24,
    frequency: 'monthly',
    purpose: 'home_improvement',
    purposeDetail: null,
    disbursementAccountId: 'acct-1',
    repaymentAccountId: 'acct-1',
    declaredMonthlyIncomeMinorUnits: 300_000,
    declaredMonthlyExpensesMinorUnits: 120_000,
    existingCommitmentsMinorUnits: 20_000,
    documents: [],
    decision: null,
    offer: acceptedOffer(),
    loanId: null,
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
