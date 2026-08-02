import { z } from 'zod';

import {
  approvalRequestSchema,
  dashboardSchema,
  isoDateSchema,
  manualPostingRequestSchema,
  monitorQuerySchema,
  reconciliationSchema,
  reverseTransactionRequestSchema,
  systemHealthSchema,
  trialBalanceSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const adminOperations = defineOperations([
  {
    method: 'get',
    path: '/admin/dashboard',
    tag: TAG.admin,
    operationId: 'getAdminDashboard',
    summary: 'Live KPIs, queue depths, and volume series (staff)',
    response: success(STATUS.ok, 'The ops dashboard.', dashboardSchema),
  },
  {
    method: 'get',
    path: '/admin/monitor',
    tag: TAG.admin,
    operationId: 'monitorTransactions',
    summary: 'The global transaction monitor (staff)',
    query: monitorQuerySchema,
    response: success(
      STATUS.ok,
      'An offset page of monitor entries.',
      PAGE_SCHEMAS.MonitorEntryPage,
    ),
  },
  {
    method: 'post',
    path: '/admin/postings',
    tag: TAG.admin,
    operationId: 'createManualPosting',
    summary: 'Manual credit/debit — double-entry, reasoned, four-eyes (staff)',
    request: manualPostingRequestSchema,
    idempotent: true,
    response: success(
      STATUS.accepted,
      'The approval request; the posting lands once a second operator approves.',
      approvalRequestSchema,
    ),
    errors: [
      { status: STATUS.notFound, description: 'The account does not exist.' },
      { status: STATUS.unprocessable },
    ],
  },
  {
    method: 'post',
    path: '/admin/transactions/{transactionId}/reverse',
    tag: TAG.admin,
    operationId: 'reverseTransaction',
    summary: 'Reverse a posted transaction (maker-checker)',
    pathParams: { transactionId: idSchema },
    request: reverseTransactionRequestSchema,
    idempotent: true,
    response: success(
      STATUS.accepted,
      'The approval request for the reversal.',
      approvalRequestSchema,
    ),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict, description: 'Already reversed, or not in a reversible state.' },
    ],
  },
  {
    method: 'get',
    path: '/admin/ledger/trial-balance',
    tag: TAG.admin,
    operationId: 'getTrialBalance',
    summary: 'The trial balance — proof the books add up (staff)',
    response: success(STATUS.ok, 'The trial balance.', trialBalanceSchema),
  },
  {
    method: 'get',
    path: '/admin/ledger/reconciliation',
    tag: TAG.admin,
    operationId: 'getReconciliation',
    summary: 'Reconciliation for a business date (staff)',
    query: z.object({ date: isoDateSchema }),
    response: success(STATUS.ok, 'The reconciliation view.', reconciliationSchema),
  },
  {
    method: 'get',
    path: '/admin/system/health',
    tag: TAG.admin,
    operationId: 'getSystemHealth',
    summary: 'Component, queue, and version health (staff)',
    response: success(STATUS.ok, 'System health.', systemHealthSchema),
  },
]);
