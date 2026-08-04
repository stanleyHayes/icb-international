import { type z } from 'zod';
import {
  cardAuthorisationSchema,
  cardDetailSchema,
  cardQuerySchema,
  cardSensitiveDetailsSchema,
  cardSummarySchema,
  cursorPageSchema,
  cursorQuerySchema,
  issueCardRequestSchema,
  reportCardRequestSchema,
  setCardPinRequestSchema,
  travelNoticeRequestSchema,
  updateCardControlsRequestSchema,
  updateCardLimitsRequestSchema,
  updateCardRequestSchema,
} from '@icb/contracts';

import { get, patch, post, postVoid, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const cardsEndpoints = {
  list: get('/cards', cursorPageSchema(cardSummarySchema), { query: cardQuerySchema }),
  issue: post('/cards', cardDetailSchema, { body: issueCardRequestSchema }),
  get: get('/cards/:cardId', cardDetailSchema),
  update: patch('/cards/:cardId', cardDetailSchema, { body: updateCardRequestSchema }),
  revealSensitive: get('/cards/:cardId/sensitive', cardSensitiveDetailsSchema),
  updateControls: patch('/cards/:cardId/controls', cardDetailSchema, {
    body: updateCardControlsRequestSchema,
  }),
  updateLimits: patch('/cards/:cardId/limits', cardDetailSchema, {
    body: updateCardLimitsRequestSchema,
  }),
  setPin: postVoid('/cards/:cardId/pin', { body: setCardPinRequestSchema }),
  report: post('/cards/:cardId/report', cardDetailSchema, { body: reportCardRequestSchema }),
  setTravelNotice: post('/cards/:cardId/travel-notice', cardDetailSchema, {
    body: travelNoticeRequestSchema,
  }),
  listAuthorisations: get('/cards/:cardId/authorisations', cursorPageSchema(cardAuthorisationSchema), {
    query: cursorQuerySchema,
  }),
};

export function createCardsApi(call: Requester) {
  return {
    list: (query?: z.input<typeof cardQuerySchema>, options?: RequestOptions) =>
      call(cardsEndpoints.list, { query, options }),
    issue: (body: z.input<typeof issueCardRequestSchema>, options?: RequestOptions) =>
      call(cardsEndpoints.issue, { body, options }),
    get: (cardId: string, options?: RequestOptions) =>
      call(cardsEndpoints.get, { params: { cardId }, options }),
    update: (cardId: string, body: z.input<typeof updateCardRequestSchema>, options?: RequestOptions) =>
      call(cardsEndpoints.update, { params: { cardId }, body, options }),
    revealSensitive: (cardId: string, options?: RequestOptions) =>
      call(cardsEndpoints.revealSensitive, { params: { cardId }, options }),
    updateControls: (
      cardId: string,
      body: z.input<typeof updateCardControlsRequestSchema>,
      options?: RequestOptions,
    ) => call(cardsEndpoints.updateControls, { params: { cardId }, body, options }),
    updateLimits: (
      cardId: string,
      body: z.input<typeof updateCardLimitsRequestSchema>,
      options?: RequestOptions,
    ) => call(cardsEndpoints.updateLimits, { params: { cardId }, body, options }),
    setPin: (cardId: string, body: z.input<typeof setCardPinRequestSchema>, options?: RequestOptions) =>
      call(cardsEndpoints.setPin, { params: { cardId }, body, options }),
    report: (cardId: string, body: z.input<typeof reportCardRequestSchema>, options?: RequestOptions) =>
      call(cardsEndpoints.report, { params: { cardId }, body, options }),
    setTravelNotice: (
      cardId: string,
      body: z.input<typeof travelNoticeRequestSchema>,
      options?: RequestOptions,
    ) => call(cardsEndpoints.setTravelNotice, { params: { cardId }, body, options }),
    listAuthorisations: (
      cardId: string,
      query?: z.input<typeof cursorQuerySchema>,
      options?: RequestOptions,
    ) => call(cardsEndpoints.listAuthorisations, { params: { cardId }, query, options }),
  };
}

export type CardsApi = ReturnType<typeof createCardsApi>;
