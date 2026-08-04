import { budgetsOverviewSchema, putBudgetsRequestSchema } from '../../../src/index.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const budgetsOperations = defineOperations([
  {
    method: 'get',
    path: '/budgets',
    tag: TAG.budgets,
    operationId: 'getBudgets',
    summary: 'Category budgets with the current month’s spend and verdict',
    response: success(STATUS.ok, 'The budgets overview.', budgetsOverviewSchema),
  },
  {
    method: 'put',
    path: '/budgets',
    tag: TAG.budgets,
    operationId: 'replaceBudgets',
    summary: 'Replace the whole budget set (idempotent by HTTP semantics)',
    request: putBudgetsRequestSchema,
    response: success(STATUS.ok, 'The budgets overview after the replace.', budgetsOverviewSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
]);
