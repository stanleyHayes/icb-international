import {
  accountDetailSchema,
  amlAlertSchema,
  approvalRequestSchema,
  auditEventSchema,
  authenticatedUserSchema,
  balanceHistorySchema,
  beneficiarySchema,
  billPaymentSchema,
  breakDepositQuoteSchema,
  cardAuthorisationSchema,
  cardDetailSchema,
  cardSensitiveDetailsSchema,
  cashflowSchema,
  clockStateSchema,
  cursorPageSchema,
  customerAdminViewSchema,
  dashboardSchema,
  disputeSchema,
  documentSchema,
  downloadLinkSchema,
  endOfDayReportSchema,
  featureFlagSchema,
  fxQuoteSchema,
  holdSchema,
  kycCaseSchema,
  kycTierLimitsSchema,
  ledgerIntegrityReportSchema,
  linkedBillSchema,
  loanApplicationSchema,
  loanDetailSchema,
  loanQuoteSchema,
  loginResponseSchema,
  mfaChallengeSchema,
  moneySchema,
  monitorEntrySchema,
  notificationSchema,
  offsetPageSchema,
  payoffQuoteSchema,
  problemDetailsSchema,
  productSchema,
  railProfileSchema,
  rateTableSchema,
  reconciliationSchema,
  riskCaseSchema,
  savingsGoalSchema,
  scenarioSchema,
  scenarioRunSchema,
  sessionSchema,
  simulationStateSchema,
  spendByCategorySchema,
  staffUserSchema,
  statementSchema,
  supportTicketSchema,
  systemHealthSchema,
  termDepositSchema,
  transactionSummarySchema,
  transferDetailSchema,
  transferQuoteSchema,
  trialBalanceSchema,
  uploadSignatureSchema,
} from '@icb/contracts';
import { describe, expect, it } from 'vitest';
import { type z } from 'zod';

import { fabricate } from '../mock/fabricate.js';
import { createMockFaker } from '../mock/faker.js';

const ITERATIONS = 5;

const SCHEMAS: Record<string, z.ZodType> = {
  money: moneySchema,
  problemDetails: problemDetailsSchema,
  authenticatedUser: authenticatedUserSchema,
  loginResponse: loginResponseSchema,
  mfaChallenge: mfaChallengeSchema,
  session: sessionSchema,
  customerAdminView: customerAdminViewSchema,
  kycCase: kycCaseSchema,
  kycTierLimits: kycTierLimitsSchema,
  uploadSignature: uploadSignatureSchema,
  accountDetail: accountDetailSchema,
  balanceHistory: balanceHistorySchema,
  hold: holdSchema,
  transactionPage: cursorPageSchema(transactionSummarySchema),
  transferQuote: transferQuoteSchema,
  transferDetail: transferDetailSchema,
  beneficiary: beneficiarySchema,
  cardDetail: cardDetailSchema,
  cardSensitiveDetails: cardSensitiveDetailsSchema,
  cardAuthorisation: cardAuthorisationSchema,
  loanQuote: loanQuoteSchema,
  loanApplication: loanApplicationSchema,
  loanDetail: loanDetailSchema,
  payoffQuote: payoffQuoteSchema,
  savingsGoal: savingsGoalSchema,
  termDeposit: termDepositSchema,
  breakDepositQuote: breakDepositQuoteSchema,
  linkedBill: linkedBillSchema,
  billPayment: billPaymentSchema,
  riskCase: riskCaseSchema,
  amlAlert: amlAlertSchema,
  dispute: disputeSchema,
  product: productSchema,
  rateTable: rateTableSchema,
  fxQuote: fxQuoteSchema,
  statement: statementSchema,
  document: documentSchema,
  downloadLink: downloadLinkSchema,
  notification: notificationSchema,
  spendByCategory: spendByCategorySchema,
  cashflow: cashflowSchema,
  supportTicket: supportTicketSchema,
  staffPage: offsetPageSchema(staffUserSchema),
  auditEvent: auditEventSchema,
  approvalRequest: approvalRequestSchema,
  dashboard: dashboardSchema,
  monitorEntry: monitorEntrySchema,
  trialBalance: trialBalanceSchema,
  reconciliation: reconciliationSchema,
  systemHealth: systemHealthSchema,
  clockState: clockStateSchema,
  railProfile: railProfileSchema,
  scenario: scenarioSchema,
  scenarioRun: scenarioRunSchema,
  endOfDayReport: endOfDayReportSchema,
  ledgerIntegrityReport: ledgerIntegrityReportSchema,
  simulationState: simulationStateSchema,
  featureFlag: featureFlagSchema,
};

describe('fabricate', () => {
  it.each(Object.keys(SCHEMAS))('generates data satisfying %s', (name) => {
    const schema = SCHEMAS[name];
    const faker = createMockFaker(99);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const candidate: unknown = fabricate(schema ?? z.unknown(), faker);
      const parsed = schema?.safeParse(candidate);
      expect(parsed?.success, JSON.stringify(parsed?.success ? null : parsed.error.issues)).toBe(
        true,
      );
    }
  });

  it('is deterministic for a given seed', () => {
    const first = fabricate(accountDetailSchema, createMockFaker(7));
    const second = fabricate(accountDetailSchema, createMockFaker(7));
    expect(first).toEqual(second);
  });
});
