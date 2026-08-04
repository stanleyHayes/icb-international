import {
  annotateTransactionRequestSchema,
  cashflowSchema,
  downloadLinkSchema,
  exportTransactionsRequestSchema,
  isoDateSchema,
  merchantsAnalyticsSchema,
  recurringAnalyticsSchema,
  spendByCategorySchema,
  transactionDetailSchema,
  transactionQuerySchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const TRANSACTION_ID = { transactionId: idSchema } as const;

/** Analytics window: the API defaults to a trailing period when `from`/`to` are omitted. */
const spendQuerySchema = spendByCategorySchema.pick({ currency: true }).extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

const cashflowQuerySchema = cashflowSchema.pick({ currency: true, granularity: true });

const currencyOnlyQuerySchema = spendByCategorySchema.pick({ currency: true });

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
    path: '/transactions/exports',
    tag: TAG.transactions,
    operationId: 'exportTransactions',
    summary: 'Export a statement-range file (CSV/OFX/PDF/JSON)',
    request: exportTransactionsRequestSchema,
    idempotent: true,
    response: success(
      STATUS.created,
      'A short-lived download link for the export.',
      downloadLinkSchema,
    ),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'get',
    path: '/transactions/analytics/spend-by-category',
    tag: TAG.transactions,
    operationId: 'getSpendByCategory',
    summary: 'Spend breakdown for the insights screen',
    query: spendQuerySchema,
    response: success(
      STATUS.ok,
      'Spend by category versus the previous period.',
      spendByCategorySchema,
    ),
  },
  {
    method: 'get',
    path: '/transactions/analytics/cashflow',
    tag: TAG.transactions,
    operationId: 'getCashflow',
    summary: 'Income versus expense over time',
    query: cashflowQuerySchema,
    response: success(STATUS.ok, 'The cashflow series.', cashflowSchema),
  },
  {
    method: 'get',
    path: '/transactions/analytics/merchants',
    tag: TAG.transactions,
    operationId: 'getMerchantsAnalytics',
    summary: 'The top merchants by total spend',
    query: spendQuerySchema,
    response: success(STATUS.ok, 'The merchant leaderboard.', merchantsAnalyticsSchema),
  },
  {
    method: 'get',
    path: '/transactions/analytics/recurring',
    tag: TAG.transactions,
    operationId: 'getRecurringAnalytics',
    summary: 'Detected subscriptions and other repeating charges',
    query: currencyOnlyQuerySchema,
    response: success(STATUS.ok, 'The recurring charges.', recurringAnalyticsSchema),
  },
]);
