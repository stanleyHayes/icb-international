import { type z } from 'zod';
import {
  annotateTransactionRequestSchema,
  cashflowSchema,
  cursorPageSchema,
  downloadLinkSchema,
  exportTransactionsRequestSchema,
  isoDateSchema,
  merchantsAnalyticsSchema,
  recurringAnalyticsSchema,
  spendByCategorySchema,
  transactionDetailSchema,
  transactionQuerySchema,
  transactionSummarySchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

const spendQuerySchema = spendByCategorySchema.pick({ currency: true }).extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

const cashflowQuerySchema = cashflowSchema.pick({ currency: true, granularity: true });

const currencyOnlyQuerySchema = spendByCategorySchema.pick({ currency: true });

export const transactionsEndpoints = {
  list: get('/transactions', cursorPageSchema(transactionSummarySchema), {
    query: transactionQuerySchema,
  }),
  get: get('/transactions/:transactionId', transactionDetailSchema),
  annotate: patch('/transactions/:transactionId', transactionDetailSchema, {
    body: annotateTransactionRequestSchema,
  }),
  export: post('/transactions/exports', downloadLinkSchema, {
    body: exportTransactionsRequestSchema,
    idempotent: true,
  }),
  spendByCategory: get('/transactions/analytics/spend-by-category', spendByCategorySchema, {
    query: spendQuerySchema,
  }),
  cashflow: get('/transactions/analytics/cashflow', cashflowSchema, { query: cashflowQuerySchema }),
  merchants: get('/transactions/analytics/merchants', merchantsAnalyticsSchema, {
    query: spendQuerySchema,
  }),
  recurring: get('/transactions/analytics/recurring', recurringAnalyticsSchema, {
    query: currencyOnlyQuerySchema,
  }),
};

export function createTransactionsApi(call: Requester) {
  return {
    list: (query?: z.input<typeof transactionQuerySchema>, options?: RequestOptions) =>
      call(transactionsEndpoints.list, { query, options }),
    get: (transactionId: string, options?: RequestOptions) =>
      call(transactionsEndpoints.get, { params: { transactionId }, options }),
    annotate: (
      transactionId: string,
      body: z.input<typeof annotateTransactionRequestSchema>,
      options?: RequestOptions,
    ) => call(transactionsEndpoints.annotate, { params: { transactionId }, body, options }),
    export: (body: z.input<typeof exportTransactionsRequestSchema>, options?: RequestOptions) =>
      call(transactionsEndpoints.export, { body, options }),
    spendByCategory: (query?: z.input<typeof spendQuerySchema>, options?: RequestOptions) =>
      call(transactionsEndpoints.spendByCategory, { query, options }),
    cashflow: (query: z.input<typeof cashflowQuerySchema>, options?: RequestOptions) =>
      call(transactionsEndpoints.cashflow, { query, options }),
    merchants: (query: z.input<typeof spendQuerySchema>, options?: RequestOptions) =>
      call(transactionsEndpoints.merchants, { query, options }),
    recurring: (query: z.input<typeof currencyOnlyQuerySchema>, options?: RequestOptions) =>
      call(transactionsEndpoints.recurring, { query, options }),
  };
}

export type TransactionsApi = ReturnType<typeof createTransactionsApi>;
