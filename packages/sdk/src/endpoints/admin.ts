import { z } from 'zod';
import {
  dashboardSchema,
  isoDateSchema,
  manualPostingRequestSchema,
  monitorEntrySchema,
  monitorQuerySchema,
  offsetPageSchema,
  reconciliationSchema,
  reverseTransactionRequestSchema,
  systemHealthSchema,
  transactionDetailSchema,
  trialBalanceSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

const reconciliationQuerySchema = z.object({ date: isoDateSchema.optional() });

export const adminEndpoints = {
  dashboard: get('/admin/dashboard', dashboardSchema),
  monitor: get('/admin/monitor', offsetPageSchema(monitorEntrySchema)),
  manualPosting: post('/admin/postings', transactionDetailSchema, {
    body: manualPostingRequestSchema,
    idempotent: true,
  }),
  reverseTransaction: post('/admin/transactions/:transactionId/reversal', transactionDetailSchema, {
    body: reverseTransactionRequestSchema,
    idempotent: true,
  }),
  trialBalance: get('/admin/ledger/trial-balance', trialBalanceSchema),
  reconciliation: get('/admin/ledger/reconciliation', reconciliationSchema),
  health: get('/admin/health', systemHealthSchema),
};

export function createAdminApi(call: Requester) {
  return {
    dashboard: (options?: RequestOptions) => call(adminEndpoints.dashboard, { options }),
    monitor: (query?: z.input<typeof monitorQuerySchema>, options?: RequestOptions) =>
      call(adminEndpoints.monitor, { query, options }),
    manualPosting: (body: z.input<typeof manualPostingRequestSchema>, options?: RequestOptions) =>
      call(adminEndpoints.manualPosting, { body, options }),
    reverseTransaction: (
      transactionId: string,
      body: z.input<typeof reverseTransactionRequestSchema>,
      options?: RequestOptions,
    ) => call(adminEndpoints.reverseTransaction, { params: { transactionId }, body, options }),
    trialBalance: (options?: RequestOptions) => call(adminEndpoints.trialBalance, { options }),
    reconciliation: (query?: z.input<typeof reconciliationQuerySchema>, options?: RequestOptions) =>
      call(adminEndpoints.reconciliation, { query, options }),
    health: (options?: RequestOptions) => call(adminEndpoints.health, { options }),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
