import { z } from 'zod';
import {
  breakDepositQuoteSchema,
  contributeToGoalRequestSchema,
  createSavingsGoalRequestSchema,
  cursorPageSchema,
  depositRateBandSchema,
  openTermDepositRequestSchema,
  savingsGoalSchema,
  savingsQuerySchema,
  termDepositSchema,
  updateSavingsGoalRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const savingsEndpoints = {
  listGoals: get('/savings/goals', cursorPageSchema(savingsGoalSchema)),
  createGoal: post('/savings/goals', savingsGoalSchema, {
    body: createSavingsGoalRequestSchema,
    idempotent: true,
  }),
  getGoal: get('/savings/goals/:goalId', savingsGoalSchema),
  updateGoal: patch('/savings/goals/:goalId', savingsGoalSchema, {
    body: updateSavingsGoalRequestSchema,
  }),
  contribute: post('/savings/goals/:goalId/contributions', savingsGoalSchema, {
    body: contributeToGoalRequestSchema,
    idempotent: true,
  }),
  listDepositRates: get('/savings/deposit-rates', z.array(depositRateBandSchema)),
  listDeposits: get('/savings/deposits', z.array(termDepositSchema)),
  openDeposit: post('/savings/deposits', termDepositSchema, {
    body: openTermDepositRequestSchema,
    idempotent: true,
  }),
  getDeposit: get('/savings/deposits/:depositId', termDepositSchema),
  breakQuote: post('/savings/deposits/:depositId/break-quote', breakDepositQuoteSchema, {}),
  breakDeposit: post('/savings/deposits/:depositId/break', termDepositSchema, {
    idempotent: true,
  }),
};

export function createSavingsApi(call: Requester) {
  return {
    listGoals: (query?: z.input<typeof savingsQuerySchema>, options?: RequestOptions) =>
      call(savingsEndpoints.listGoals, { query, options }),
    createGoal: (body: z.input<typeof createSavingsGoalRequestSchema>, options?: RequestOptions) =>
      call(savingsEndpoints.createGoal, { body, options }),
    getGoal: (goalId: string, options?: RequestOptions) =>
      call(savingsEndpoints.getGoal, { params: { goalId }, options }),
    updateGoal: (
      goalId: string,
      body: z.input<typeof updateSavingsGoalRequestSchema>,
      options?: RequestOptions,
    ) => call(savingsEndpoints.updateGoal, { params: { goalId }, body, options }),
    contribute: (
      goalId: string,
      body: z.input<typeof contributeToGoalRequestSchema>,
      options?: RequestOptions,
    ) => call(savingsEndpoints.contribute, { params: { goalId }, body, options }),
    listDepositRates: (options?: RequestOptions) =>
      call(savingsEndpoints.listDepositRates, { options }),
    listDeposits: (options?: RequestOptions) => call(savingsEndpoints.listDeposits, { options }),
    openDeposit: (body: z.input<typeof openTermDepositRequestSchema>, options?: RequestOptions) =>
      call(savingsEndpoints.openDeposit, { body, options }),
    getDeposit: (depositId: string, options?: RequestOptions) =>
      call(savingsEndpoints.getDeposit, { params: { depositId }, options }),
    breakQuote: (depositId: string, options?: RequestOptions) =>
      call(savingsEndpoints.breakQuote, { params: { depositId }, options }),
    breakDeposit: (depositId: string, options?: RequestOptions) =>
      call(savingsEndpoints.breakDeposit, { params: { depositId }, options }),
  };
}

export type SavingsApi = ReturnType<typeof createSavingsApi>;
