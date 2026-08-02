import { z } from 'zod';
import {
  bulkTransferRequestSchema,
  bulkTransferResultSchema,
  cancelTransferRequestSchema,
  createTransferRequestSchema,
  createTransferTemplateRequestSchema,
  cursorPageSchema,
  standingOrderSchema,
  transferDetailSchema,
  transferQuerySchema,
  transferQuoteRequestSchema,
  transferQuoteSchema,
  transferSummarySchema,
  transferTemplateSchema,
} from '@icb/contracts';

import { del, get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const transfersEndpoints = {
  quote: post('/transfers/quotes', transferQuoteSchema, {
    body: transferQuoteRequestSchema,
    idempotent: true,
  }),
  create: post('/transfers', transferDetailSchema, {
    body: createTransferRequestSchema,
    idempotent: true,
  }),
  createBulk: post('/transfers/bulk', bulkTransferResultSchema, {
    body: bulkTransferRequestSchema,
    idempotent: true,
  }),
  list: get('/transfers', cursorPageSchema(transferSummarySchema), { query: transferQuerySchema }),
  get: get('/transfers/:transferId', transferDetailSchema),
  cancel: post('/transfers/:transferId/cancel', transferDetailSchema, {
    body: cancelTransferRequestSchema,
    idempotent: true,
  }),
  listTemplates: get('/transfer-templates', z.array(transferTemplateSchema)),
  createTemplate: post('/transfer-templates', transferTemplateSchema, {
    body: createTransferTemplateRequestSchema,
  }),
  deleteTemplate: del('/transfer-templates/:templateId'),
  listStandingOrders: get('/standing-orders', z.array(standingOrderSchema)),
  cancelStandingOrder: post('/standing-orders/:standingOrderId/cancel', standingOrderSchema, {}),
};

export function createTransfersApi(call: Requester) {
  return {
    quote: (body: z.input<typeof transferQuoteRequestSchema>, options?: RequestOptions) =>
      call(transfersEndpoints.quote, { body, options }),
    create: (body: z.input<typeof createTransferRequestSchema>, options?: RequestOptions) =>
      call(transfersEndpoints.create, { body, options }),
    createBulk: (body: z.input<typeof bulkTransferRequestSchema>, options?: RequestOptions) =>
      call(transfersEndpoints.createBulk, { body, options }),
    list: (query?: z.input<typeof transferQuerySchema>, options?: RequestOptions) =>
      call(transfersEndpoints.list, { query, options }),
    get: (transferId: string, options?: RequestOptions) =>
      call(transfersEndpoints.get, { params: { transferId }, options }),
    cancel: (
      transferId: string,
      body: z.input<typeof cancelTransferRequestSchema>,
      options?: RequestOptions,
    ) => call(transfersEndpoints.cancel, { params: { transferId }, body, options }),
    listTemplates: (options?: RequestOptions) => call(transfersEndpoints.listTemplates, { options }),
    createTemplate: (
      body: z.input<typeof createTransferTemplateRequestSchema>,
      options?: RequestOptions,
    ) => call(transfersEndpoints.createTemplate, { body, options }),
    deleteTemplate: (templateId: string, options?: RequestOptions) =>
      call(transfersEndpoints.deleteTemplate, { params: { templateId }, options }),
    listStandingOrders: (options?: RequestOptions) =>
      call(transfersEndpoints.listStandingOrders, { options }),
    cancelStandingOrder: (standingOrderId: string, options?: RequestOptions) =>
      call(transfersEndpoints.cancelStandingOrder, { params: { standingOrderId }, options }),
  };
}

export type TransfersApi = ReturnType<typeof createTransfersApi>;
