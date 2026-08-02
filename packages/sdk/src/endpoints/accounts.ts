import { z } from 'zod';
import {
  accountBalancesSchema,
  accountDetailSchema,
  accountSummarySchema,
  balanceHistoryQuerySchema,
  balanceHistorySchema,
  closeAccountRequestSchema,
  holdSchema,
  openAccountRequestSchema,
  setAccountStatusRequestSchema,
  setOverdraftRequestSchema,
  updateAccountRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const accountsEndpoints = {
  list: get('/accounts', z.array(accountSummarySchema)),
  open: post('/accounts', accountDetailSchema, {
    body: openAccountRequestSchema,
    idempotent: true,
  }),
  get: get('/accounts/:accountId', accountDetailSchema),
  update: patch('/accounts/:accountId', accountDetailSchema, { body: updateAccountRequestSchema }),
  close: post('/accounts/:accountId/close', accountDetailSchema, {
    body: closeAccountRequestSchema,
    idempotent: true,
  }),
  balances: get('/accounts/:accountId/balances', accountBalancesSchema),
  balanceHistory: get('/accounts/:accountId/balance-history', balanceHistorySchema),
  holds: get('/accounts/:accountId/holds', z.array(holdSchema)),
  adminSetStatus: post('/admin/accounts/:accountId/status', accountDetailSchema, {
    body: setAccountStatusRequestSchema,
  }),
  adminSetOverdraft: post('/admin/accounts/:accountId/overdraft', accountDetailSchema, {
    body: setOverdraftRequestSchema,
  }),
};

export function createAccountsApi(call: Requester) {
  return {
    list: (options?: RequestOptions) => call(accountsEndpoints.list, { options }),
    open: (body: z.input<typeof openAccountRequestSchema>, options?: RequestOptions) =>
      call(accountsEndpoints.open, { body, options }),
    get: (accountId: string, options?: RequestOptions) =>
      call(accountsEndpoints.get, { params: { accountId }, options }),
    update: (
      accountId: string,
      body: z.input<typeof updateAccountRequestSchema>,
      options?: RequestOptions,
    ) => call(accountsEndpoints.update, { params: { accountId }, body, options }),
    close: (
      accountId: string,
      body: z.input<typeof closeAccountRequestSchema>,
      options?: RequestOptions,
    ) => call(accountsEndpoints.close, { params: { accountId }, body, options }),
    balances: (accountId: string, options?: RequestOptions) =>
      call(accountsEndpoints.balances, { params: { accountId }, options }),
    balanceHistory: (
      accountId: string,
      query?: z.input<typeof balanceHistoryQuerySchema>,
      options?: RequestOptions,
    ) => call(accountsEndpoints.balanceHistory, { params: { accountId }, query, options }),
    holds: (accountId: string, options?: RequestOptions) =>
      call(accountsEndpoints.holds, { params: { accountId }, options }),
    adminSetStatus: (
      accountId: string,
      body: z.input<typeof setAccountStatusRequestSchema>,
      options?: RequestOptions,
    ) => call(accountsEndpoints.adminSetStatus, { params: { accountId }, body, options }),
    adminSetOverdraft: (
      accountId: string,
      body: z.input<typeof setOverdraftRequestSchema>,
      options?: RequestOptions,
    ) => call(accountsEndpoints.adminSetOverdraft, { params: { accountId }, body, options }),
  };
}

export type AccountsApi = ReturnType<typeof createAccountsApi>;
