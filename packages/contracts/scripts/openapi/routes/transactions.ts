import { z } from 'zod';

import {
  annotateTransactionRequestSchema,
  cashflowSchema,
  downloadLinkSchema,
  exportTransactionsRequestSchema,
  spendByCategorySchema,
  transactionDetailSchema,
  transactionQuerySchema,
} from '../../../src/index.js';
import { idSchema, isoDateSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const TRANSACTION_ID = { transactionId: idSchema } as const;

const insightsQuerySchema = z.object({
  accountId: idSchema.optional(),
  from: isoDateSchema,
  to: isoDateSchema,
});

const cashflowQuerySchema = insightsQuerySchema.extend({
  granularity: z.enum(['week', 'month']).default('month'),
});

export const transactionsOperations = defineOperations([
  {
    method: 'get',
    path: '/transactions',
    tag: TAG.transactions,
    operationId: 'listTransactions',
    summary: 'Search and page transactions',
    query: transactionQuerySchema,
    response: success(
      STATUS.ok,
      'A cursor page of transactions.',
      PAGE_SCHEMAS.TransactionSummaryPage,
    ),
  },
  {
    method: 'get',
    path: '/transactions/{transactionId}',
    tag: TAG.transactions,
    operationId: 'getTransaction',
    summary: 'Transaction detail with postings, fees, and FX',
    pathParams: TRANSACTION_ID,
    response: success(STATUS.ok, 'The transaction.', transactionDetailSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'patch',
    path: '/transactions/{transactionId}',
    tag: TAG.transactions,
    operationId: 'annotateTransaction',
    summary: 'Set note, category, or tags',
    pathParams: TRANSACTION_ID,
    request: annotateTransactionRequestSchema,
    response: success(STATUS.ok, 'The updated transaction.', transactionDetailSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.unprocessable }],
  },
  {
    method: 'post',
    path: '/transactions/export',
    tag: TAG.transactions,
    operationId: 'exportTransactions',
    summary: 'Export a statement-range file (CSV/OFX/PDF/JSON)',
    request: exportTransactionsRequestSchema,
    response: success(
      STATUS.accepted,
      'A short-lived download link for the export.',
      downloadLinkSchema,
    ),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'get',
    path: '/transactions/insights/spend-by-category',
    tag: TAG.transactions,
    operationId: 'getSpendByCategory',
    summary: 'Spend breakdown for the insights screen',
    query: insightsQuerySchema,
    response: success(
      STATUS.ok,
      'Spend by category versus the previous period.',
      spendByCategorySchema,
    ),
  },
  {
    method: 'get',
    path: '/transactions/insights/cashflow',
    tag: TAG.transactions,
    operationId: 'getCashflow',
    summary: 'Income versus expense over time',
    query: cashflowQuerySchema,
    response: success(STATUS.ok, 'The cashflow series.', cashflowSchema),
  },
]);
