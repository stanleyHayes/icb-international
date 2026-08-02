import { z } from 'zod';

import { transferRailSchema, transferStatusSchema } from '../common/enums.js';
import { cursorQuerySchema } from '../common/pagination.js';
import {
  countryCodeSchema,
  currencySchema,
  idSchema,
  isoDateTimeSchema,
  moneySchema,
  positiveMoneySchema,
} from '../common/primitives.js';
import { feeBreakdownSchema, fxDetailSchema } from '../transactions/transactions.contract.js';

/**
 * Where money is going.
 *
 * A discriminated union rather than a bag of optional fields, so the type system refuses to let
 * a SWIFT payment be submitted without a BIC.
 */
export const transferDestinationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('own_account'),
    accountId: idSchema,
  }),
  z.object({
    kind: z.literal('icb_customer'),
    accountNumber: z.string().regex(/^\d{10}$/),
  }),
  z.object({
    kind: z.literal('domestic_bank'),
    accountNumber: z.string().min(6).max(20),
    sortCode: z.string().regex(/^\d{2}-\d{2}-\d{2}$/),
    accountHolderName: z.string().min(1).max(140),
  }),
  z.object({
    kind: z.literal('international'),
    iban: z.string().min(15).max(34),
    bic: z.string().min(8).max(11),
    accountHolderName: z.string().min(1).max(140),
    country: countryCodeSchema,
    bankName: z.string().max(140).optional(),
  }),
  z.object({
    kind: z.literal('beneficiary'),
    beneficiaryId: idSchema,
  }),
]);

export type TransferDestination = z.infer<typeof transferDestinationSchema>;

/** Ask what a transfer would cost before committing to it. Quotes are single-use and expire. */
export const transferQuoteRequestSchema = z.object({
  fromAccountId: idSchema,
  destination: transferDestinationSchema,
  amount: positiveMoneySchema,
  /** When the amounts differ in currency, which side the customer fixed. */
  amountSide: z.enum(['debit', 'credit']).default('debit'),
  rail: transferRailSchema.optional(),
  reference: z.string().max(140).optional(),
});

export const transferQuoteSchema = z.object({
  quoteId: idSchema,
  rail: transferRailSchema,
  debitAmount: moneySchema,
  creditAmount: moneySchema,
  fees: z.array(feeBreakdownSchema),
  totalFees: moneySchema,
  totalDebit: moneySchema,
  fx: fxDetailSchema.nullable(),
  estimatedArrival: isoDateTimeSchema,
  cutOffAt: isoDateTimeSchema.nullable(),
  requiresStepUp: z.boolean(),
  requiresApproval: z.boolean(),
  expiresAt: isoDateTimeSchema,
});

export const scheduleSchema = z.object({
  /** RFC 5545 RRULE. Absent means a single future-dated transfer. */
  rrule: z.string().max(500).optional(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date().optional(),
  maxOccurrences: z.int().positive().max(500).optional(),
});

export const createTransferRequestSchema = z.object({
  /** Redeem a quote, or supply the terms inline and accept the prevailing rate. */
  quoteId: idSchema.optional(),
  fromAccountId: idSchema,
  destination: transferDestinationSchema,
  amount: positiveMoneySchema,
  reference: z.string().max(140).optional(),
  note: z.string().max(500).optional(),
  schedule: scheduleSchema.optional(),
  saveBeneficiary: z.boolean().default(false),
  beneficiaryNickname: z.string().max(60).optional(),
});

export const transferSummarySchema = z.object({
  id: idSchema,
  reference: z.string(),
  status: transferStatusSchema,
  rail: transferRailSchema,
  fromAccountId: idSchema,
  fromAccountLabel: z.string(),
  recipientName: z.string(),
  recipientMasked: z.string(),
  debitAmount: moneySchema,
  creditAmount: moneySchema,
  createdAt: isoDateTimeSchema,
  executeAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  recurring: z.boolean(),
});

export const transferTimelineEventSchema = z.object({
  at: isoDateTimeSchema,
  status: transferStatusSchema,
  label: z.string(),
  detail: z.string().nullable(),
});

export const transferDetailSchema = transferSummarySchema.extend({
  destination: transferDestinationSchema,
  fees: z.array(feeBreakdownSchema),
  totalFees: moneySchema,
  fx: fxDetailSchema.nullable(),
  note: z.string().nullable(),
  schedule: scheduleSchema.nullable(),
  nextOccurrenceAt: isoDateTimeSchema.nullable(),
  transactionId: idSchema.nullable(),
  estimatedArrival: isoDateTimeSchema,
  timeline: z.array(transferTimelineEventSchema),
  failureCode: z.string().nullable(),
  failureReason: z.string().nullable(),
  cancellable: z.boolean(),
});

export const transferQuerySchema = cursorQuerySchema.extend({
  accountId: idSchema.optional(),
  status: z.array(transferStatusSchema).optional(),
  rail: z.array(transferRailSchema).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  recurringOnly: z.coerce.boolean().optional(),
});

export const cancelTransferRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** A saved set of transfer terms the customer can re-run in one tap. */
export const transferTemplateSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(60),
  fromAccountId: idSchema,
  destination: transferDestinationSchema,
  amount: moneySchema.nullable(),
  reference: z.string().nullable(),
  lastUsedAt: isoDateTimeSchema.nullable(),
  useCount: z.int().nonnegative(),
});

export const createTransferTemplateRequestSchema = z.object({
  name: z.string().min(1).max(60),
  fromAccountId: idSchema,
  destination: transferDestinationSchema,
  amount: positiveMoneySchema.optional(),
  reference: z.string().max(140).optional(),
});

/** Bulk upload — one row per payment, validated as a batch before anything is executed. */
export const bulkTransferRowSchema = z.object({
  rowNumber: z.int().positive(),
  destination: transferDestinationSchema,
  amount: positiveMoneySchema,
  reference: z.string().max(140).optional(),
});

export const bulkTransferRequestSchema = z.object({
  fromAccountId: idSchema,
  rows: z.array(bulkTransferRowSchema).min(1).max(500),
  executeAt: isoDateTimeSchema.optional(),
});

export const bulkTransferResultSchema = z.object({
  batchId: idSchema,
  accepted: z.int().nonnegative(),
  rejected: z.int().nonnegative(),
  totalDebit: moneySchema,
  failures: z.array(z.object({ rowNumber: z.int(), code: z.string(), message: z.string() })),
});

export const standingOrderSchema = z.object({
  id: idSchema,
  name: z.string(),
  fromAccountId: idSchema,
  destination: transferDestinationSchema,
  amount: moneySchema,
  currency: currencySchema,
  schedule: scheduleSchema,
  nextRunAt: isoDateTimeSchema.nullable(),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']),
  executedCount: z.int().nonnegative(),
  createdAt: isoDateTimeSchema,
});

export type TransferQuoteRequest = z.infer<typeof transferQuoteRequestSchema>;
export type TransferQuote = z.infer<typeof transferQuoteSchema>;
export type CreateTransferRequest = z.infer<typeof createTransferRequestSchema>;
export type TransferSummary = z.infer<typeof transferSummarySchema>;
export type TransferDetail = z.infer<typeof transferDetailSchema>;
export type TransferQuery = z.infer<typeof transferQuerySchema>;
export type TransferTemplate = z.infer<typeof transferTemplateSchema>;
export type BulkTransferRequest = z.infer<typeof bulkTransferRequestSchema>;
export type BulkTransferResult = z.infer<typeof bulkTransferResultSchema>;
export type StandingOrder = z.infer<typeof standingOrderSchema>;
export type TransferSchedule = z.infer<typeof scheduleSchema>;
