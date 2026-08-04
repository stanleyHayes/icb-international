import { type z } from 'zod';
import { budgetsOverviewSchema, putBudgetsRequestSchema } from '@icb/contracts';

import { get, put, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const budgetsEndpoints = {
  overview: get('/budgets', budgetsOverviewSchema),
  replace: put('/budgets', budgetsOverviewSchema, { body: putBudgetsRequestSchema }),
};

export function createBudgetsApi(call: Requester) {
  return {
    overview: (options?: RequestOptions) => call(budgetsEndpoints.overview, { options }),
    replace: (body: z.input<typeof putBudgetsRequestSchema>, options?: RequestOptions) =>
      call(budgetsEndpoints.replace, { body, options }),
  };
}

export type BudgetsApi = ReturnType<typeof createBudgetsApi>;
