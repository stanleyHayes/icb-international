import { type z } from 'zod';
import {
  blockCardRequestSchema,
  cardAuthorisationSchema,
  cardDetailSchema,
  cardQuerySchema,
  cardSummarySchema,
  cursorPageSchema,
  cursorQuerySchema,
  expireHoldRequestSchema,
  issueCardRequestSchema,
  reissueCardRequestSchema,
  updateCardLimitsRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

/** The staff console's cards surface (`/admin/cards`), role-gated server-side. */
export const adminCardsEndpoints = {
  listCards: get('/admin/cards', cursorPageSchema(cardSummarySchema), {
    query: cardQuerySchema,
  }),
  issueCard: post('/admin/cards', cardDetailSchema, {
    body: issueCardRequestSchema,
    idempotent: true,
  }),
  getCard: get('/admin/cards/:cardId', cardDetailSchema),
  blockCard: post('/admin/cards/:cardId/block', cardDetailSchema, {
    body: blockCardRequestSchema,
    idempotent: true,
  }),
  reissueCard: post('/admin/cards/:cardId/reissue', cardDetailSchema, {
    body: reissueCardRequestSchema,
    idempotent: true,
  }),
  resetCardPin: post('/admin/cards/:cardId/pin-reset', cardDetailSchema, {
    idempotent: true,
  }),
  updateCardLimits: patch('/admin/cards/:cardId/limits', cardDetailSchema, {
    body: updateCardLimitsRequestSchema,
  }),
  listCardAuthorisations: get(
    '/admin/cards/:cardId/authorisations',
    cursorPageSchema(cardAuthorisationSchema),
    { query: cursorQuerySchema },
  ),
  expireAuthorisation: post(
    '/admin/cards/:cardId/authorisations/:authorisationId/expire',
    cardAuthorisationSchema,
    { body: expireHoldRequestSchema, idempotent: true },
  ),
};

export function createAdminCardsApi(call: Requester) {
  return {
    listCards: (query?: z.input<typeof cardQuerySchema>, options?: RequestOptions) =>
      call(adminCardsEndpoints.listCards, { query, options }),
    issueCard: (body: z.input<typeof issueCardRequestSchema>, options?: RequestOptions) =>
      call(adminCardsEndpoints.issueCard, { body, options }),
    getCard: (cardId: string, options?: RequestOptions) =>
      call(adminCardsEndpoints.getCard, { params: { cardId }, options }),
    blockCard: (
      cardId: string,
      body: z.input<typeof blockCardRequestSchema>,
      options?: RequestOptions,
    ) => call(adminCardsEndpoints.blockCard, { params: { cardId }, body, options }),
    reissueCard: (
      cardId: string,
      body: z.input<typeof reissueCardRequestSchema>,
      options?: RequestOptions,
    ) => call(adminCardsEndpoints.reissueCard, { params: { cardId }, body, options }),
    resetCardPin: (cardId: string, options?: RequestOptions) =>
      call(adminCardsEndpoints.resetCardPin, { params: { cardId }, options }),
    updateCardLimits: (
      cardId: string,
      body: z.input<typeof updateCardLimitsRequestSchema>,
      options?: RequestOptions,
    ) => call(adminCardsEndpoints.updateCardLimits, { params: { cardId }, body, options }),
  };
}

export type AdminCardsApi = ReturnType<typeof createAdminCardsApi>;
