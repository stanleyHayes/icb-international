import { z } from 'zod';

import { accountKindSchema, accountStatusSchema } from '../common/enums.js';
import {
  currencySchema,
  idSchema,
  isoDateTimeSchema,
  moneySchema,
  positiveMoneySchema,
} from '../common/primitives.js';

/**
 * Account balances.
 *
 * Three numbers, never conflated:
 *  - `ledger`    — the sum of posted entries. What the bank owes.
 *  - `holds`     — authorised but not yet posted. Money the customer has already committed.
 *  - `available` — ledger − holds + overdraft. What can actually be spent right now.
 *
 * A UI that shows only one of these will mislead someone on the day it matters.
 */
export const accountBalancesSchema = z.object({
  ledger: moneySchema,
  holds: moneySchema,
  available: moneySchema,
  overdraftLimit: moneySchema,
  asOf: isoDateTimeSchema,
});

export const accountIdentifiersSchema = z.object({
  /** Domestic account number, 10 digits. */
  number: z.string().regex(/^\d{10}$/),
  /** MOD-97 valid IBAN. */
  iban: z.string().min(15).max(34),
  /** ICB's BIC. Constant, but returned so a client never hard-codes it. */
  bic: z.string().length(8).or(z.string().length(11)),
  sortCode: z.string().regex(/^\d{2}-\d{2}-\d{2}$/),
});

export const accountSummarySchema = z.object({
  id: idSchema,
  kind: accountKindSchema,
  productCode: z.string(),
  productName: z.string(),
  nickname: z.string().max(60).nullable(),
  currency: currencySchema,
  status: accountStatusSchema,
  balances: accountBalancesSchema,
  identifiers: accountIdentifiersSchema,
  primary: z.boolean(),
  openedAt: isoDateTimeSchema,
});

export const accountDetailSchema = accountSummarySchema.extend({
  customerId: idSchema,
  interestRate: z.number().nonnegative().nullable().describe('Annual nominal rate as a percentage'),
  minimumBalance: moneySchema.nullable(),
  monthlyFee: moneySchema.nullable(),
  closedAt: isoDateTimeSchema.nullable(),
  closureReason: z.string().nullable(),
  statementDay: z.int().min(1).max(28),
  lastStatementAt: isoDateTimeSchema.nullable(),
});

export const openAccountRequestSchema = z.object({
  productCode: z.string().min(1).max(40),
  currency: currencySchema,
  nickname: z.string().max(60).optional(),
  initialDeposit: positiveMoneySchema.optional(),
});

export const updateAccountRequestSchema = z.object({
  nickname: z.string().max(60).nullable().optional(),
  primary: z.boolean().optional(),
  statementDay: z.int().min(1).max(28).optional(),
});

export const closeAccountRequestSchema = z.object({
  reason: z.string().min(4).max(500),
  /** Where any residual balance should be swept. Required unless the balance is already zero. */
  sweepToAccountId: idSchema.optional(),
});

export const setAccountStatusRequestSchema = z.object({
  status: accountStatusSchema,
  reason: z.string().min(4).max(500),
});

export const setOverdraftRequestSchema = z.object({
  limit: moneySchema,
  reason: z.string().min(4).max(500),
});

/** One point on the balance-history chart. */
export const balancePointSchema = z.object({
  date: z.iso.date(),
  closing: moneySchema,
});

export const balanceHistoryQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});

export const balanceHistorySchema = z.object({
  accountId: idSchema,
  currency: currencySchema,
  granularity: z.enum(['day', 'week', 'month']),
  points: z.array(balancePointSchema),
});

/** A reservation against available balance that has not yet become a posting. */
export const holdSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  amount: moneySchema,
  reason: z.string(),
  sourceReference: z.string().nullable(),
  placedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  releasedAt: isoDateTimeSchema.nullable(),
});

export type AccountBalances = z.infer<typeof accountBalancesSchema>;
export type AccountIdentifiers = z.infer<typeof accountIdentifiersSchema>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export type AccountDetail = z.infer<typeof accountDetailSchema>;
export type OpenAccountRequest = z.infer<typeof openAccountRequestSchema>;
export type UpdateAccountRequest = z.infer<typeof updateAccountRequestSchema>;
export type BalanceHistory = z.infer<typeof balanceHistorySchema>;
export type BalancePoint = z.infer<typeof balancePointSchema>;
export type Hold = z.infer<typeof holdSchema>;
