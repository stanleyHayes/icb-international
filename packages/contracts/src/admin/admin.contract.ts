import { z } from 'zod';

import { entryDirectionSchema, transactionStatusSchema } from '../common/enums.js';
import { offsetQuerySchema } from '../common/pagination.js';
import { idSchema, isoDateTimeSchema, moneySchema } from '../common/primitives.js';

/** A single headline figure with its trend, as rendered on the ops dashboard. */
export const kpiSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.union([moneySchema, z.number()]),
  format: z.enum(['money', 'count', 'percent', 'duration']),
  changePercent: z.number().nullable(),
  trend: z.enum(['up', 'down', 'flat']),
  /** Whether "up" is good. Rising fraud alerts and rising deposits are not the same news. */
  positiveDirection: z.enum(['up', 'down', 'neutral']),
});

export const dashboardSchema = z.object({
  asOf: isoDateTimeSchema,
  kpis: z.array(kpiSchema),
  queues: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      depth: z.int().nonnegative(),
      overdue: z.int().nonnegative(),
      href: z.string(),
    }),
  ),
  volumeSeries: z.array(
    z.object({ period: z.string(), count: z.int().nonnegative(), value: moneySchema }),
  ),
  railBreakdown: z.array(
    z.object({ rail: z.string(), count: z.int().nonnegative(), value: moneySchema }),
  ),
});

/** The global transaction monitor: every posting in the bank, filterable. */
export const monitorEntrySchema = z.object({
  transactionId: idSchema,
  reference: z.string(),
  at: isoDateTimeSchema,
  customerId: idSchema.nullable(),
  customerName: z.string().nullable(),
  accountLabel: z.string(),
  type: z.string(),
  status: transactionStatusSchema,
  direction: entryDirectionSchema,
  amount: moneySchema,
  rail: z.string().nullable(),
  riskScore: z.int().nullable(),
  flagged: z.boolean(),
});

export const monitorQuerySchema = offsetQuerySchema.extend({
  q: z.string().max(120).optional(),
  status: z.array(transactionStatusSchema).optional(),
  minMinorUnits: z.coerce.number().int().optional(),
  flaggedOnly: z.coerce.boolean().optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

/**
 * A manual posting made by staff.
 *
 * Always double-entry, always reasoned, always four-eyes. This is the most dangerous endpoint in
 * the system and is treated accordingly.
 */
export const manualPostingRequestSchema = z
  .object({
    accountId: idSchema,
    direction: entryDirectionSchema,
    amount: moneySchema.refine((value) => value.minorUnits > 0, {
      error: 'Amount must be greater than zero',
    }),
    /** The internal chart-of-accounts code forming the other leg. */
    contraAccountCode: z.string().regex(/^\d{4}$/),
    description: z.string().min(4).max(200),
    reason: z.string().min(10).max(1000),
    valueDate: z.iso.date().optional(),
  })
  .describe('Requires approval by a second operator before it posts');

export const reverseTransactionRequestSchema = z.object({
  reason: z.string().min(10).max(1000),
});

/** Trial balance — the report that proves the bank's books add up. */
export const trialBalanceSchema = z.object({
  asOf: isoDateTimeSchema,
  currency: z.string(),
  lines: z.array(
    z.object({
      accountCode: z.string(),
      accountName: z.string(),
      type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense', 'contra']),
      debit: moneySchema,
      credit: moneySchema,
      balance: moneySchema,
    }),
  ),
  totalDebits: moneySchema,
  totalCredits: moneySchema,
  balanced: z.boolean(),
});

export const reconciliationSchema = z.object({
  businessDate: z.iso.date(),
  openingBalance: moneySchema,
  closingBalance: moneySchema,
  movements: z.array(z.object({ label: z.string(), amount: moneySchema })),
  unreconciled: z.array(
    z.object({ transactionId: idSchema, reference: z.string(), amount: moneySchema, reason: z.string() }),
  ),
  reconciled: z.boolean(),
});

export const systemHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'down']),
  components: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['healthy', 'degraded', 'down']),
      latencyMs: z.number().nullable(),
      detail: z.string().nullable(),
    }),
  ),
  queues: z.array(
    z.object({
      name: z.string(),
      waiting: z.int().nonnegative(),
      active: z.int().nonnegative(),
      failed: z.int().nonnegative(),
      completed: z.int().nonnegative(),
    }),
  ),
  uptimeSeconds: z.int().nonnegative(),
  version: z.string(),
  checkedAt: isoDateTimeSchema,
});

export type Kpi = z.infer<typeof kpiSchema>;
export type AdminDashboard = z.infer<typeof dashboardSchema>;
export type MonitorEntry = z.infer<typeof monitorEntrySchema>;
export type MonitorQuery = z.infer<typeof monitorQuerySchema>;
export type ManualPostingRequest = z.infer<typeof manualPostingRequestSchema>;
export type TrialBalance = z.infer<typeof trialBalanceSchema>;
export type Reconciliation = z.infer<typeof reconciliationSchema>;
export type SystemHealth = z.infer<typeof systemHealthSchema>;
