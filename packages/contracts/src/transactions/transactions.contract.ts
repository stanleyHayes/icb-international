import { z } from 'zod';

import {
  entryDirectionSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from '../common/enums.js';
import { cursorQuerySchema } from '../common/pagination.js';
import {
  currencySchema,
  idSchema,
  isoDateTimeSchema,
  metadataSchema,
  moneySchema,
} from '../common/primitives.js';

export const TRANSACTION_CATEGORIES = [
  'income',
  'salary',
  'transfer',
  'groceries',
  'dining',
  'transport',
  'fuel',
  'travel',
  'shopping',
  'entertainment',
  'utilities',
  'rent',
  'healthcare',
  'education',
  'insurance',
  'subscriptions',
  'fees',
  'interest',
  'loan',
  'savings',
  'cash',
  'other',
] as const;

export const transactionCategorySchema = z.enum(TRANSACTION_CATEGORIES);
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const counterpartySchema = z.object({
  name: z.string(),
  /** Masked — last four only. A full account number is never returned to a customer. */
  accountNumberMasked: z.string().nullable(),
  bank: z.string().nullable(),
  logoUrl: z.url().nullable(),
});

export const merchantSchema = z.object({
  name: z.string(),
  category: transactionCategorySchema,
  mcc: z.string().length(4).nullable(),
  city: z.string().nullable(),
  country: z.string().length(2).nullable(),
  logoUrl: z.url().nullable(),
});

/**
 * A transaction as a customer sees it on their account.
 *
 * `direction` is relative to *this* account: the same ledger transaction appears as a debit on
 * the sender's list and a credit on the recipient's.
 */
export const transactionSummarySchema = z.object({
  id: idSchema,
  accountId: idSchema,
  reference: z.string(),
  type: transactionTypeSchema,
  status: transactionStatusSchema,
  direction: entryDirectionSchema,
  amount: moneySchema,
  /** Balance on this account immediately after this transaction posted. Null while pending. */
  runningBalance: moneySchema.nullable(),
  description: z.string(),
  category: transactionCategorySchema,
  merchant: merchantSchema.nullable(),
  counterparty: counterpartySchema.nullable(),
  bookedAt: isoDateTimeSchema,
  valueDate: z.iso.date(),
  pending: z.boolean(),
});

/** One side of one posting. The customer-facing rendering of a ledger entry. */
export const postingSchema = z.object({
  id: idSchema,
  accountLabel: z.string(),
  direction: entryDirectionSchema,
  amount: moneySchema,
  valueDate: z.iso.date(),
  sequence: z.int().nonnegative(),
});

export const feeBreakdownSchema = z.object({
  code: z.string(),
  label: z.string(),
  amount: moneySchema,
});

export const fxDetailSchema = z.object({
  fromAmount: moneySchema,
  toAmount: moneySchema,
  rate: z.number().positive(),
  spreadBps: z.int().nonnegative(),
});

export const transactionDetailSchema = transactionSummarySchema.extend({
  postings: z.array(postingSchema),
  fees: z.array(feeBreakdownSchema),
  fx: fxDetailSchema.nullable(),
  note: z.string().max(500).nullable(),
  tags: z.array(z.string().max(30)),
  attachmentCount: z.int().nonnegative(),
  relatedTransferId: idSchema.nullable(),
  relatedCardId: idSchema.nullable(),
  reversalOfId: idSchema.nullable(),
  reversedById: idSchema.nullable(),
  disputeId: idSchema.nullable(),
  metadata: metadataSchema,
  settledAt: isoDateTimeSchema.nullable(),
});

export const transactionQuerySchema = cursorQuerySchema.extend({
  accountId: idSchema.optional(),
  q: z.string().max(120).optional(),
  type: z.array(transactionTypeSchema).optional(),
  status: z.array(transactionStatusSchema).optional(),
  category: z.array(transactionCategorySchema).optional(),
  direction: entryDirectionSchema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  minMinorUnits: z.coerce.number().int().optional(),
  maxMinorUnits: z.coerce.number().int().optional(),
  currency: currencySchema.optional(),
  includePending: z.coerce.boolean().default(true),
});

export const annotateTransactionRequestSchema = z.object({
  note: z.string().max(500).nullable().optional(),
  category: transactionCategorySchema.optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const EXPORT_FORMATS = ['csv', 'ofx', 'pdf', 'json'] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);

export const exportTransactionsRequestSchema = z.object({
  accountId: idSchema,
  format: exportFormatSchema,
  from: z.iso.date(),
  to: z.iso.date(),
});

/** Spending analytics for the insights screen. */
export const spendByCategorySchema = z.object({
  period: z.object({ from: z.iso.date(), to: z.iso.date() }),
  currency: currencySchema,
  total: moneySchema,
  categories: z.array(
    z.object({
      category: transactionCategorySchema,
      amount: moneySchema,
      share: z.number().min(0).max(1),
      transactionCount: z.int().nonnegative(),
      changeFromPreviousPeriod: z.number().nullable(),
    }),
  ),
});

export const cashflowPointSchema = z.object({
  period: z.string(),
  income: moneySchema,
  expense: moneySchema,
  net: moneySchema,
});

export const cashflowSchema = z.object({
  currency: currencySchema,
  granularity: z.enum(['week', 'month']),
  points: z.array(cashflowPointSchema),
});

export type TransactionSummary = z.infer<typeof transactionSummarySchema>;
export type TransactionDetail = z.infer<typeof transactionDetailSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type Posting = z.infer<typeof postingSchema>;
export type Merchant = z.infer<typeof merchantSchema>;
export type Counterparty = z.infer<typeof counterpartySchema>;
export type FeeBreakdown = z.infer<typeof feeBreakdownSchema>;
export type FxDetail = z.infer<typeof fxDetailSchema>;
export type SpendByCategory = z.infer<typeof spendByCategorySchema>;
export type Cashflow = z.infer<typeof cashflowSchema>;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
