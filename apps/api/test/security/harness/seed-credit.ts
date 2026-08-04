import type { Connection } from 'mongoose';

import { FIXED_NOW } from './identities.js';
import { insertDoc, CURRENCY } from './resources.js';
import type { MoneySeedContext } from './seed-money.js';

/** An active personal loan with an empty schedule (detail endpoint tolerates it). */
export async function seedLoan(
  connection: Connection,
  ctx: MoneySeedContext,
  applicationId: string,
): Promise<string> {
  return insertDoc(connection, 'loans', {
    reference: 'LON-SEC02A',
    applicationId,
    customerId: ctx.customerId,
    accountId: ctx.accountId,
    repaymentAccountId: ctx.accountId,
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal Loan',
    status: 'active',
    currency: CURRENCY,
    principalMinorUnits: 500_000,
    outstandingPrincipalMinorUnits: 500_000,
    accruedInterestMinorUnits: 0,
    feesOutstandingMinorUnits: 0,
    rate: 12.5,
    termMonths: 12,
    frequency: 'monthly',
    instalmentMinorUnits: 44_500,
    schedule: [],
    lastAccrualOn: null,
    maturesOn: '2025-01-02',
    disbursedAt: FIXED_NOW,
    disbursementTransactionId: null,
    settledAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
}

export async function seedLoanApplication(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  return insertDoc(connection, 'loan_applications', {
    reference: 'APP-SEC02A',
    customerId: ctx.customerId,
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal Loan',
    status: 'submitted',
    requestedMinorUnits: 500_000,
    currency: CURRENCY,
    termMonths: 12,
    frequency: 'monthly',
    purpose: 'home_improvement',
    purposeDetail: null,
    disbursementAccountId: ctx.accountId,
    repaymentAccountId: ctx.accountId,
    declaredMonthlyIncomeMinorUnits: 900_000,
    declaredMonthlyExpensesMinorUnits: 200_000,
    existingCommitmentsMinorUnits: 0,
    documents: [],
    decision: null,
    offer: null,
    loanId: null,
    submittedAt: FIXED_NOW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
}

export async function seedSavingsGoal(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  return insertDoc(connection, 'savings_goals', {
    customerId: ctx.customerId,
    accountId: ctx.accountId,
    name: 'Emergency fund',
    icon: 'vault',
    targetMinorUnits: 1_000_000,
    currency: CURRENCY,
    targetDate: null,
    roundUpsEnabled: false,
    autoContribution: null,
    status: 'active',
    createdAt: FIXED_NOW,
    achievedAt: null,
  });
}

export async function seedTermDeposit(connection: Connection, ctx: MoneySeedContext): Promise<string> {
  return insertDoc(connection, 'term_deposits', {
    customerId: ctx.customerId,
    accountId: ctx.accountId,
    fundingAccountId: ctx.accountId,
    reference: 'TD-SEC02A',
    principalMinorUnits: 250_000,
    currency: CURRENCY,
    rate: 4.5,
    termMonths: 12,
    openedOn: '2024-01-02',
    maturesOn: '2025-01-02',
    maturityInstruction: 'payout',
    rolloverAccountId: null,
    status: 'active',
    interestPaidMinorUnits: 0,
    accruedTo: '2024-01-02',
    breakQuote: null,
    rolledFromDepositId: null,
    openedAt: FIXED_NOW,
    maturedAt: null,
    brokenAt: null,
  });
}

/** A biller directory entry plus the customer's linked bill and a past payment. */
export async function seedBill(connection: Connection, ctx: MoneySeedContext): Promise<{ billId: string; paymentId: string }> {
  const billerId = await insertBiller(connection);
  const billId = await insertDoc(connection, 'linked_bills', {
    customerId: ctx.customerId,
    billerId,
    customerReference: '1234567890',
    nickname: null,
    currency: CURRENCY,
    outstandingMinorUnits: 42_000,
    dueOn: '2024-02-01',
    enquiryCycle: null,
    enquiredAt: FIXED_NOW,
    autopayEnabled: false,
    autopayFromAccountId: null,
    autopayStrategy: 'full_balance',
    autopayFixedMinorUnits: null,
    autopayDaysBeforeDue: 2,
    autopayCapMinorUnits: null,
    autopayLastDueOn: null,
    lastPaidAt: null,
    lastPaidMinorUnits: null,
    createdAt: FIXED_NOW,
  });
  const paymentId = await insertPayment(connection, ctx, billerId, billId);
  return { billId, paymentId };
}

function insertPayment(
  connection: Connection,
  ctx: MoneySeedContext,
  billerId: string,
  billId: string,
): Promise<string> {
  return insertDoc(connection, 'bill_payments', {
    customerId: ctx.customerId,
    billId,
    billerId,
    billerName: 'Electricity Company of Ghana',
    customerReference: '1234567890',
    fromAccountId: ctx.accountId,
    amountMinorUnits: 42_000,
    feeMinorUnits: 0,
    currency: CURRENCY,
    status: 'completed',
    billerReference: 'ECG-0001',
    failureReason: null,
    transactionId: null,
    reversalTransactionId: null,
    scheduledFor: null,
    createdAt: FIXED_NOW,
  });
}

function insertBiller(connection: Connection): Promise<string> {
  return insertDoc(connection, 'billers', {
    code: 'ECG',
    name: 'Electricity Company of Ghana',
    category: 'utilities',
    logoUrl: null,
    referenceLabel: 'Meter number',
    referencePattern: null,
    supportsBalanceEnquiry: false,
    minimumAmountMinorUnits: null,
    feeMinorUnits: 0,
    failureRate: 0,
    typicalBillMinorUnits: 42_000,
    currency: CURRENCY,
    active: true,
  });
}
