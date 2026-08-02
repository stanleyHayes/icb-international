import { z } from 'zod';
import {
  advanceDisputeRequestSchema,
  createDisputeRequestSchema,
  cursorPageSchema,
  disputeQuerySchema,
  disputeSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const disputesEndpoints = {
  list: get('/disputes', cursorPageSchema(disputeSchema)),
  create: post('/disputes', disputeSchema, {
    body: createDisputeRequestSchema,
    idempotent: true,
  }),
  get: get('/disputes/:disputeId', disputeSchema),
  adminAdvance: post('/admin/disputes/:disputeId/advance', disputeSchema, {
    body: advanceDisputeRequestSchema,
  }),
};

export function createDisputesApi(call: Requester) {
  return {
    list: (query?: z.input<typeof disputeQuerySchema>, options?: RequestOptions) =>
      call(disputesEndpoints.list, { query, options }),
    create: (body: z.input<typeof createDisputeRequestSchema>, options?: RequestOptions) =>
      call(disputesEndpoints.create, { body, options }),
    get: (disputeId: string, options?: RequestOptions) =>
      call(disputesEndpoints.get, { params: { disputeId }, options }),
    adminAdvance: (
      disputeId: string,
      body: z.input<typeof advanceDisputeRequestSchema>,
      options?: RequestOptions,
    ) => call(disputesEndpoints.adminAdvance, { params: { disputeId }, body, options }),
  };
}

export type DisputesApi = ReturnType<typeof createDisputesApi>;
