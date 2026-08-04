import { z } from 'zod';

import { moneySchema, positiveMoneySchema } from '../common/primitives.js';
import { transactionCategorySchema } from '../transactions/transactions.contract.js';

/** The most categories one customer can budget at once — a form, not a data dump. */
export const MAX_BUDGETS_PER_CUSTOMER = 20;

/** How the month's spend stands against the limit, worst last. */
export const BUDGET_STATUSES = ['on_track', 'approaching', 'exceeded'] as const;
export const budgetStatusSchema = z.enum(BUDGET_STATUSES);

/** One budget line as the wire sees it: the limit, the month's actuals, and the verdict. */
export const budgetLineSchema = z.object({
  category: transactionCategorySchema,
  limit: moneySchema,
  spent: moneySchema,
  status: budgetStatusSchema,
});

/** The full budget surface for the current calendar month. */
export const budgetsOverviewSchema = z.object({
  /** The calendar month the spend figures cover, e.g. `2026-08`. */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  budgets: z.array(budgetLineSchema),
});

/**
 * PUT replaces the customer's whole set — idempotent by HTTP semantics, so no idempotency
 * key is needed. A category may appear at most once.
 */
export const putBudgetsRequestSchema = z.object({
  budgets: z
    .array(z.object({ category: transactionCategorySchema, limit: positiveMoneySchema }))
    .max(MAX_BUDGETS_PER_CUSTOMER)
    .refine((rows) => new Set(rows.map((row) => row.category)).size === rows.length, {
      error: 'Each category may only appear once',
    }),
});

export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type BudgetLine = z.infer<typeof budgetLineSchema>;
export type BudgetsOverview = z.infer<typeof budgetsOverviewSchema>;
export type PutBudgetsRequest = z.infer<typeof putBudgetsRequestSchema>;
