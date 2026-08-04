import { type z } from 'zod';
import {
  approvalRequestSchema,
  type cursorQuerySchema,
  type expireHoldRequestSchema,
  itemsEnvelopeSchema,
  kpiSchema,
  ledgerIntegrityReportSchema,
  manualPostingRequestSchema,
  monitorEntrySchema,
  systemHealthSchema,
  trialBalanceSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';
import { adminCardsEndpoints, createAdminCardsApi } from './admin-cards.js';

const adminCoreEndpoints = {
  kpis: get('/admin/kpis', itemsEnvelopeSchema(kpiSchema)),
  monitor: get('/admin/monitor', itemsEnvelopeSchema(monitorEntrySchema)),
  ledgerIntegrity: get('/admin/ledger-integrity', ledgerIntegrityReportSchema),
  manualPosting: post('/admin/postings', approvalRequestSchema, {
    body: manualPostingRequestSchema,
    idempotent: true,
  }),
  trialBalance: get('/admin/trial-balance', trialBalanceSchema),
  health: get('/admin/health', systemHealthSchema),
};

export const adminEndpoints = { ...adminCoreEndpoints, ...adminCardsEndpoints };

export function createAdminApi(call: Requester) {
  return {
    kpis: (options?: RequestOptions) => call(adminEndpoints.kpis, { options }),
    monitor: (options?: RequestOptions) => call(adminEndpoints.monitor, { options }),
    ledgerIntegrity: (options?: RequestOptions) =>
      call(adminEndpoints.ledgerIntegrity, { options }),
    manualPosting: (body: z.input<typeof manualPostingRequestSchema>, options?: RequestOptions) =>
      call(adminEndpoints.manualPosting, { body, options }),
    trialBalance: (options?: RequestOptions) => call(adminEndpoints.trialBalance, { options }),
    health: (options?: RequestOptions) => call(adminEndpoints.health, { options }),
    ...createAdminCardsApi(call),
    listCardAuthorisations: (
      cardId: string,
      query?: z.input<typeof cursorQuerySchema>,
      options?: RequestOptions,
    ) => call(adminCardsEndpoints.listCardAuthorisations, { params: { cardId }, query, options }),
    expireAuthorisation: (
      cardId: string,
      authorisationId: string,
      body: z.input<typeof expireHoldRequestSchema>,
      options?: RequestOptions,
    ) =>
      call(adminCardsEndpoints.expireAuthorisation, {
        params: { cardId, authorisationId },
        body,
        options,
      }),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
