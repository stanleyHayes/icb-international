import { z } from 'zod';
import {
  breakDepositQuoteSchema,
  contributeToGoalRequestSchema,
  createSavingsGoalRequestSchema,
  currencySchema,
  depositRateBandSchema,
  itemsEnvelopeSchema,
  openTermDepositRequestSchema,
  savingsGoalSchema,
  termDepositSchema,
  updateSavingsGoalRequestSchema,
  updateTermDepositRequestSchema,
} from '@icb/contracts';

import { del, get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

/** The published rate card defaults to the bank's base currency; pass one to override. */
const depositRatesQuerySchema = z.object({ currency: currencySchema.optional() });

export const savingsEndpoints = {
  listGoals: get('/savings/goals', itemsEnvelopeSchema(savingsGoalSchema)),
  createGoal: post('/savings/goals', savingsGoalSchema, {
    body: createSavingsGoalRequestSchema,
    idempotent: true,
  }),
  getGoal: get('/savings/goals/:goalId', savingsGoalSchema),
  updateGoal: patch('/savings/goals/:goalId', savingsGoalSchema, {
    body: updateSavingsGoalRequestSchema,
  }),
  removeGoal: del('/savings/goals/:goalId'),
  contribute: post('/savings/goals/:goalId/contribute', savingsGoalSchema, {
    body: contributeToGoalRequestSchema,
    idempotent: true,
  }),
  listDepositRates: get('/savings/rates', itemsEnvelopeSchema(depositRateBandSchema), {
    query: depositRatesQuerySchema,
  }),
  listDeposits: get('/savings/deposits', itemsEnvelopeSchema(termDepositSchema)),
  openDeposit: post('/savings/deposits', termDepositSchema, {
    body: openTermDepositRequestSchema,
    idempotent: true,
  }),
  getDeposit: get('/savings/deposits/:depositId', termDepositSchema),
  updateDeposit: patch('/savings/deposits/:depositId', termDepositSchema, {
    body: updateTermDepositRequestSchema,
  }),
  breakQuote: get('/savings/deposits/:depositId/break-quote', breakDepositQuoteSchema),
  breakDeposit: post('/savings/deposits/:depositId/break', termDepositSchema, {
    idempotent: true,
  }),
};

export function createSavingsApi(call: Requester) {
  return {
    listGoals: (options?: RequestOptions) => call(savingsEndpoints.listGoals, { options }),
    createGoal: (body: z.input<typeof createSavingsGoalRequestSchema>, options?: RequestOptions) =>
      call(savingsEndpoints.createGoal, { body, options }),
    getGoal: (goalId: string, options?: RequestOptions) =>
      call(savingsEndpoints.getGoal, { params: { goalId }, options }),
    updateGoal: (
      goalId: string,
      body: z.input<typeof updateSavingsGoalRequestSchema>,
      options?: RequestOptions,
    ) => call(savingsEndpoints.updateGoal, { params: { goalId }, body, options }),
    removeGoal: (goalId: string, options?: RequestOptions) =>
      call(savingsEndpoints.removeGoal, { params: { goalId }, options }),
    contribute: (
      goalId: string,
      body: z.input<typeof contributeToGoalRequestSchema>,
      options?: RequestOptions,
    ) => call(savingsEndpoints.contribute, { params: { goalId }, body, options }),
    listDepositRates: (query?: z.input<typeof depositRatesQuerySchema>, options?: RequestOptions) =>
      call(savingsEndpoints.listDepositRates, { query, options }),
    listDeposits: (options?: RequestOptions) => call(savingsEndpoints.listDeposits, { options }),
    openDeposit: (body: z.input<typeof openTermDepositRequestSchema>, options?: RequestOptions) =>
      call(savingsEndpoints.openDeposit, { body, options }),
    getDeposit: (depositId: string, options?: RequestOptions) =>
      call(savingsEndpoints.getDeposit, { params: { depositId }, options }),
    updateDeposit: (
      depositId: string,
      body: z.input<typeof updateTermDepositRequestSchema>,
      options?: RequestOptions,
    ) => call(savingsEndpoints.updateDeposit, { params: { depositId }, body, options }),
    breakQuote: (depositId: string, options?: RequestOptions) =>
      call(savingsEndpoints.breakQuote, { params: { depositId }, options }),
    breakDeposit: (depositId: string, options?: RequestOptions) =>
      call(savingsEndpoints.breakDeposit, { params: { depositId }, options }),
  };
}

export type SavingsApi = ReturnType<typeof createSavingsApi>;
