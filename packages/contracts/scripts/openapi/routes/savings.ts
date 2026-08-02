import { z } from 'zod';

import {
  breakDepositQuoteSchema,
  contributeToGoalRequestSchema,
  createSavingsGoalRequestSchema,
  depositRateBandSchema,
  openTermDepositRequestSchema,
  savingsGoalSchema,
  savingsQuerySchema,
  termDepositSchema,
  updateSavingsGoalRequestSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const GOAL_ID = { goalId: idSchema } as const;
const DEPOSIT_ID = { depositId: idSchema } as const;

export const savingsOperations = defineOperations([
  {
    method: 'get', path: '/savings/goals', tag: TAG.savings, operationId: 'listSavingsGoals',
    summary: 'Savings goals with progress',
    query: savingsQuerySchema,
    response: success(STATUS.ok, 'A cursor page of goals.', PAGE_SCHEMAS.SavingsGoalPage),
  },
  {
    method: 'post', path: '/savings/goals', tag: TAG.savings, operationId: 'createSavingsGoal',
    summary: 'Create a goal against a savings account',
    request: createSavingsGoalRequestSchema,
    response: success(STATUS.created, 'The created goal.', savingsGoalSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'patch', path: '/savings/goals/{goalId}', tag: TAG.savings, operationId: 'updateSavingsGoal',
    summary: 'Edit, pause, or cancel a goal',
    pathParams: GOAL_ID,
    request: updateSavingsGoalRequestSchema,
    response: success(STATUS.ok, 'The updated goal.', savingsGoalSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.unprocessable }],
  },
  {
    method: 'post', path: '/savings/goals/{goalId}/contributions', tag: TAG.savings,
    operationId: 'contributeToGoal', summary: 'Move money into a goal',
    pathParams: GOAL_ID,
    request: contributeToGoalRequestSchema,
    idempotent: true,
    response: success(STATUS.ok, 'The goal after the contribution.', savingsGoalSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.unprocessable, description: 'Insufficient funds in the source account.' },
    ],
  },
  {
    method: 'get', path: '/savings/deposits/rates', tag: TAG.savings, operationId: 'listDepositRates',
    summary: 'The term/rate matrix for fixed deposits',
    response: success(STATUS.ok, 'Current rate bands.', z.array(depositRateBandSchema)),
  },
  {
    method: 'get', path: '/savings/deposits', tag: TAG.savings, operationId: 'listTermDeposits',
    summary: 'The customer’s fixed deposits',
    response: success(STATUS.ok, 'All deposits with accrual.', z.array(termDepositSchema)),
  },
  {
    method: 'post', path: '/savings/deposits', tag: TAG.savings, operationId: 'openTermDeposit',
    summary: 'Open a fixed deposit',
    request: openTermDepositRequestSchema,
    idempotent: true,
    response: success(STATUS.created, 'The opened deposit.', termDepositSchema),
    errors: [
      { status: STATUS.unprocessable, description: 'Below the band minimum, or insufficient funds.' },
    ],
  },
  {
    method: 'get', path: '/savings/deposits/{depositId}', tag: TAG.savings, operationId: 'getTermDeposit',
    summary: 'Deposit detail',
    pathParams: DEPOSIT_ID,
    response: success(STATUS.ok, 'The deposit.', termDepositSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'get', path: '/savings/deposits/{depositId}/break-quote', tag: TAG.savings,
    operationId: 'quoteDepositBreak', summary: 'Preview the early-withdrawal penalty',
    pathParams: DEPOSIT_ID,
    response: success(STATUS.ok, 'The break quote.', breakDepositQuoteSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict }],
  },
  {
    method: 'post', path: '/savings/deposits/{depositId}/break', tag: TAG.savings,
    operationId: 'breakTermDeposit', summary: 'Break the deposit early on the quoted terms',
    pathParams: DEPOSIT_ID,
    idempotent: true,
    response: success(STATUS.ok, 'The broken deposit.', termDepositSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict, description: 'Already matured or broken.' },
    ],
  },
]);
