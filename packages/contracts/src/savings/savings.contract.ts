import { z } from 'zod';

import { cursorQuerySchema } from '../common/pagination.js';
import {
  currencySchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  positiveMoneySchema,
} from '../common/primitives.js';

/** A named savings target with automatic contributions. */
export const savingsGoalSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  name: z.string().min(1).max(80),
  icon: z.string().max(40),
  target: moneySchema,
  saved: moneySchema,
  progress: z.number().min(0).max(1),
  targetDate: isoDateSchema.nullable(),
  /** What must be set aside per month to hit the target date. Null when there is no date. */
  requiredMonthly: moneySchema.nullable(),
  onTrack: z.boolean().nullable(),
  autoContribution: z
    .object({
      amount: moneySchema,
      frequency: z.enum(['weekly', 'fortnightly', 'monthly']),
      nextRunOn: isoDateSchema,
      fromAccountId: idSchema,
    })
    .nullable(),
  roundUpsEnabled: z.boolean(),
  status: z.enum(['active', 'achieved', 'paused', 'cancelled']),
  createdAt: isoDateTimeSchema,
  achievedAt: isoDateTimeSchema.nullable(),
});

export const createSavingsGoalRequestSchema = z.object({
  accountId: idSchema,
  name: z.string().min(1).max(80),
  icon: z.string().max(40).default('target'),
  target: positiveMoneySchema,
  targetDate: isoDateSchema.optional(),
  roundUpsEnabled: z.boolean().default(false),
  autoContribution: z
    .object({
      amount: positiveMoneySchema,
      frequency: z.enum(['weekly', 'fortnightly', 'monthly']),
      fromAccountId: idSchema,
    })
    .optional(),
});

export const updateSavingsGoalRequestSchema = createSavingsGoalRequestSchema
  .omit({ accountId: true })
  .partial()
  .extend({ status: z.enum(['active', 'paused', 'cancelled']).optional() });

export const contributeToGoalRequestSchema = z.object({
  fromAccountId: idSchema,
  amount: positiveMoneySchema,
});

/**
 * Term deposit.
 *
 * Interest accrues daily and capitalises at maturity or on the agreed schedule. Breaking early
 * forfeits a share of accrued interest, quoted up front rather than discovered afterwards.
 */
export const termDepositSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  reference: z.string(),
  principal: moneySchema,
  currency: currencySchema,
  rate: z.number().nonnegative(),
  termMonths: z.int().positive(),
  accruedInterest: moneySchema,
  projectedInterest: moneySchema,
  maturityValue: moneySchema,
  openedOn: isoDateSchema,
  maturesOn: isoDateSchema,
  maturityInstruction: z.enum(['rollover_principal', 'rollover_all', 'transfer_out']),
  rolloverAccountId: idSchema.nullable(),
  status: z.enum(['active', 'matured', 'broken', 'closed']),
  brokenAt: isoDateTimeSchema.nullable(),
});

export const depositRateBandSchema = z.object({
  termMonths: z.int().positive(),
  minimumAmount: moneySchema,
  rate: z.number().nonnegative(),
});

export const openTermDepositRequestSchema = z.object({
  fromAccountId: idSchema,
  principal: positiveMoneySchema,
  termMonths: z.int().positive().max(120),
  maturityInstruction: z
    .enum(['rollover_principal', 'rollover_all', 'transfer_out'])
    .default('transfer_out'),
  rolloverAccountId: idSchema.optional(),
});

export const breakDepositQuoteSchema = z.object({
  depositId: idSchema,
  principal: moneySchema,
  accruedInterest: moneySchema,
  penalty: moneySchema,
  netProceeds: moneySchema,
  interestForfeited: moneySchema,
  validUntil: isoDateTimeSchema,
});

/** What happens at maturity. Changing it never moves money by itself. */
export const updateTermDepositRequestSchema = z.object({
  maturityInstruction: z.enum(['rollover_principal', 'rollover_all', 'transfer_out']),
  /** Where the proceeds go on `transfer_out` — and where a rollover draws fees from. */
  rolloverAccountId: idSchema.optional(),
});

export const savingsQuerySchema = cursorQuerySchema.extend({
  status: z.array(z.enum(['active', 'achieved', 'paused', 'cancelled'])).optional(),
});

export type SavingsGoal = z.infer<typeof savingsGoalSchema>;
export type CreateSavingsGoalRequest = z.infer<typeof createSavingsGoalRequestSchema>;
export type TermDeposit = z.infer<typeof termDepositSchema>;
export type DepositRateBand = z.infer<typeof depositRateBandSchema>;
export type OpenTermDepositRequest = z.infer<typeof openTermDepositRequestSchema>;
export type BreakDepositQuote = z.infer<typeof breakDepositQuoteSchema>;
export type UpdateTermDepositRequest = z.infer<typeof updateTermDepositRequestSchema>;
