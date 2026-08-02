import { z } from 'zod';

import { loanStatusSchema, repaymentFrequencySchema } from '../common/enums.js';
import { cursorQuerySchema } from '../common/pagination.js';
import {
  assetRefSchema,
  currencySchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  positiveMoneySchema,
} from '../common/primitives.js';

export const loanProductSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  currency: currencySchema,
  minimumAmount: moneySchema,
  maximumAmount: moneySchema,
  minimumTermMonths: z.int().positive(),
  maximumTermMonths: z.int().positive(),
  /** Annual nominal rate, as a percentage. Representative APR is computed with fees included. */
  fromRate: z.number().nonnegative(),
  toRate: z.number().nonnegative(),
  arrangementFeePercent: z.number().nonnegative(),
  earlyRepaymentFeePercent: z.number().nonnegative(),
  requiresCollateral: z.boolean(),
});

/** One row of an amortisation schedule. Interest and principal always re-sum to the instalment. */
export const repaymentInstalmentSchema = z.object({
  number: z.int().positive(),
  dueOn: isoDateSchema,
  instalment: moneySchema,
  principal: moneySchema,
  interest: moneySchema,
  fees: moneySchema,
  openingBalance: moneySchema,
  closingBalance: moneySchema,
  status: z.enum(['scheduled', 'due', 'paid', 'partially_paid', 'overdue', 'written_off']),
  paidAt: isoDateTimeSchema.nullable(),
  paidAmount: moneySchema.nullable(),
});

export const loanQuoteRequestSchema = z.object({
  productCode: z.string().min(1).max(40),
  amount: positiveMoneySchema,
  termMonths: z.int().positive().max(480),
  frequency: repaymentFrequencySchema.default('monthly'),
});

export const loanQuoteSchema = z.object({
  productCode: z.string(),
  amount: moneySchema,
  termMonths: z.int(),
  frequency: repaymentFrequencySchema,
  nominalRate: z.number(),
  representativeApr: z.number(),
  instalment: moneySchema,
  arrangementFee: moneySchema,
  totalInterest: moneySchema,
  totalRepayable: moneySchema,
  firstPaymentOn: isoDateSchema,
  schedule: z.array(repaymentInstalmentSchema),
  /** Indicative only — a full decision runs affordability and bureau checks. */
  indicative: z.boolean(),
});

export const loanApplicationRequestSchema = z.object({
  productCode: z.string().min(1).max(40),
  amount: positiveMoneySchema,
  termMonths: z.int().positive().max(480),
  frequency: repaymentFrequencySchema.default('monthly'),
  purpose: z.enum([
    'home_improvement',
    'debt_consolidation',
    'vehicle',
    'education',
    'medical',
    'business',
    'travel',
    'other',
  ]),
  purposeDetail: z.string().max(500).optional(),
  disbursementAccountId: idSchema,
  repaymentAccountId: idSchema,
  declaredMonthlyIncome: positiveMoneySchema,
  declaredMonthlyExpenses: moneySchema,
  existingCommitments: moneySchema,
});

export const scorecardFactorSchema = z.object({
  code: z.string(),
  label: z.string(),
  weight: z.number(),
  contribution: z.number(),
  detail: z.string().nullable(),
});

/**
 * The underwriting result, including *why*.
 *
 * A decline that cannot be explained is a decline that cannot be appealed, audited, or improved.
 * The factor list is surfaced to the underwriter in the admin console and, in summary form, to
 * the applicant.
 */
export const loanDecisionSchema = z.object({
  outcome: z.enum(['approved', 'referred', 'declined']),
  score: z.int().min(0).max(1000),
  band: z.enum(['excellent', 'good', 'fair', 'poor', 'very_poor']),
  factors: z.array(scorecardFactorSchema),
  approvedAmount: moneySchema.nullable(),
  approvedRate: z.number().nullable(),
  reasons: z.array(z.string()),
  decidedBy: z.string(),
  decidedAt: isoDateTimeSchema,
});

export const loanApplicationSchema = z.object({
  id: idSchema,
  reference: z.string(),
  customerId: idSchema,
  productCode: z.string(),
  productName: z.string(),
  status: loanStatusSchema,
  requestedAmount: moneySchema,
  termMonths: z.int(),
  frequency: repaymentFrequencySchema,
  purpose: z.string(),
  documents: z.array(z.object({ label: z.string(), asset: assetRefSchema })),
  decision: loanDecisionSchema.nullable(),
  offer: z
    .object({
      amount: moneySchema,
      rate: z.number(),
      instalment: moneySchema,
      expiresAt: isoDateTimeSchema,
      acceptedAt: isoDateTimeSchema.nullable(),
    })
    .nullable(),
  submittedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const loanArrearsSchema = z.object({
  amount: moneySchema,
  daysPastDue: z.int().nonnegative(),
  bucket: z.enum(['current', '1_29', '30_59', '60_89', '90_plus']),
  missedInstalments: z.int().nonnegative(),
});

export const loanSchema = z.object({
  id: idSchema,
  reference: z.string(),
  accountId: idSchema,
  customerId: idSchema,
  productCode: z.string(),
  productName: z.string(),
  status: loanStatusSchema,
  principal: moneySchema,
  outstandingPrincipal: moneySchema,
  outstandingInterest: moneySchema,
  totalOutstanding: moneySchema,
  rate: z.number(),
  termMonths: z.int(),
  frequency: repaymentFrequencySchema,
  instalment: moneySchema,
  nextPaymentOn: isoDateSchema.nullable(),
  nextPaymentAmount: moneySchema.nullable(),
  paidInstalments: z.int().nonnegative(),
  remainingInstalments: z.int().nonnegative(),
  arrears: loanArrearsSchema.nullable(),
  disbursedAt: isoDateTimeSchema.nullable(),
  maturesOn: isoDateSchema,
  settledAt: isoDateTimeSchema.nullable(),
});

export const loanDetailSchema = loanSchema.extend({
  schedule: z.array(repaymentInstalmentSchema),
  repaymentAccountId: idSchema,
});

export const payoffQuoteSchema = z.object({
  loanId: idSchema,
  asOf: isoDateSchema,
  outstandingPrincipal: moneySchema,
  accruedInterest: moneySchema,
  earlyRepaymentFee: moneySchema,
  totalPayoff: moneySchema,
  savingsVersusTerm: moneySchema,
  validUntil: isoDateTimeSchema,
});

export const makeRepaymentRequestSchema = z.object({
  fromAccountId: idSchema,
  amount: positiveMoneySchema,
  /** `scheduled` pays the next instalment; `extra` reduces principal; `payoff` settles in full. */
  kind: z.enum(['scheduled', 'extra', 'payoff']).default('scheduled'),
});

export const loanQuerySchema = cursorQuerySchema.extend({
  status: z.array(loanStatusSchema).optional(),
  inArrearsOnly: z.coerce.boolean().optional(),
});

export type LoanProduct = z.infer<typeof loanProductSchema>;
export type LoanQuote = z.infer<typeof loanQuoteSchema>;
export type LoanQuoteRequest = z.infer<typeof loanQuoteRequestSchema>;
export type LoanApplication = z.infer<typeof loanApplicationSchema>;
export type LoanApplicationRequest = z.infer<typeof loanApplicationRequestSchema>;
export type LoanDecision = z.infer<typeof loanDecisionSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type LoanDetail = z.infer<typeof loanDetailSchema>;
export type RepaymentInstalment = z.infer<typeof repaymentInstalmentSchema>;
export type PayoffQuote = z.infer<typeof payoffQuoteSchema>;
export type LoanArrears = z.infer<typeof loanArrearsSchema>;
export type ScorecardFactor = z.infer<typeof scorecardFactorSchema>;
export type MakeRepaymentRequest = z.infer<typeof makeRepaymentRequestSchema>;
