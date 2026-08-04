import { z } from 'zod';
import {
  contentLocationViewSchema,
  faqArticleViewSchema,
  faqCreateRequestSchema,
  faqQuerySchema,
  faqUpdateRequestSchema,
  locationCreateRequestSchema,
  locationUpdateRequestSchema,
  rateEntryUpsertRequestSchema,
  rateEntryViewSchema,
  rateTableSchema,
  templateOverrideViewSchema,
  templatePreviewRequestSchema,
  templatePreviewResultSchema,
  templateUpsertRequestSchema,
} from '@icb/contracts';

import { del, get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

/**
 * The content surface: anonymous reads for the marketing site (`/content/*`) and the
 * role-gated staff console (`/admin/content/*`, ADM-15).
 */
export const contentEndpoints = {
  // ---- Public ----
  listPublishedFaq: get('/content/faq', z.array(faqArticleViewSchema), {
    query: faqQuerySchema,
    auth: false,
  }),
  listActiveLocations: get('/content/locations', z.array(contentLocationViewSchema), {
    auth: false,
  }),
  rates: get('/content/rates', rateTableSchema, { auth: false }),

  // ---- Staff: FAQ articles ----
  listFaq: get('/admin/content/faq', z.array(faqArticleViewSchema)),
  createFaq: post('/admin/content/faq', faqArticleViewSchema, { body: faqCreateRequestSchema }),
  updateFaq: patch('/admin/content/faq/:articleId', faqArticleViewSchema, {
    body: faqUpdateRequestSchema,
  }),
  deleteFaq: del('/admin/content/faq/:articleId'),

  // ---- Staff: branches & ATMs ----
  listLocations: get('/admin/content/locations', z.array(contentLocationViewSchema)),
  createLocation: post('/admin/content/locations', contentLocationViewSchema, {
    body: locationCreateRequestSchema,
  }),
  updateLocation: patch('/admin/content/locations/:locationId', contentLocationViewSchema, {
    body: locationUpdateRequestSchema,
  }),
  deleteLocation: del('/admin/content/locations/:locationId'),

  // ---- Staff: notification template overrides ----
  listTemplates: get('/admin/content/templates', z.array(templateOverrideViewSchema)),
  previewTemplate: post('/admin/content/templates/preview', templatePreviewResultSchema, {
    body: templatePreviewRequestSchema,
  }),
  upsertTemplate: post('/admin/content/templates', templateOverrideViewSchema, {
    body: templateUpsertRequestSchema,
  }),
  deleteTemplate: del('/admin/content/templates/:templateId'),

  // ---- Staff: marketing rate-table entries ----
  listRateEntries: get('/admin/content/rates', z.array(rateEntryViewSchema)),
  upsertRateEntry: post('/admin/content/rates', rateEntryViewSchema, {
    body: rateEntryUpsertRequestSchema,
  }),
  deleteRateEntry: del('/admin/content/rates/:entryId'),
};

export function createContentApi(call: Requester) {
  return { ...createContentPublicApi(call), ...createContentStaffApi(call) };
}

function createContentPublicApi(call: Requester) {
  return {
    listPublishedFaq: (query?: z.input<typeof faqQuerySchema>, options?: RequestOptions) =>
      call(contentEndpoints.listPublishedFaq, { query, options }),
    listActiveLocations: (options?: RequestOptions) =>
      call(contentEndpoints.listActiveLocations, { options }),
    rates: (options?: RequestOptions) => call(contentEndpoints.rates, { options }),
  };
}

function createContentStaffApi(call: Requester) {
  return {
    ...createContentFaqApi(call),
    ...createContentLocationApi(call),
    ...createContentTemplateApi(call),
    ...createContentRatesApi(call),
  };
}

function createContentFaqApi(call: Requester) {
  return {
    listFaq: (options?: RequestOptions) => call(contentEndpoints.listFaq, { options }),
    createFaq: (body: z.input<typeof faqCreateRequestSchema>, options?: RequestOptions) =>
      call(contentEndpoints.createFaq, { body, options }),
    updateFaq: (
      articleId: string,
      body: z.input<typeof faqUpdateRequestSchema>,
      options?: RequestOptions,
    ) => call(contentEndpoints.updateFaq, { params: { articleId }, body, options }),
    deleteFaq: (articleId: string, options?: RequestOptions) =>
      call(contentEndpoints.deleteFaq, { params: { articleId }, options }),
  };
}

function createContentLocationApi(call: Requester) {
  return {
    listLocations: (options?: RequestOptions) => call(contentEndpoints.listLocations, { options }),
    createLocation: (body: z.input<typeof locationCreateRequestSchema>, options?: RequestOptions) =>
      call(contentEndpoints.createLocation, { body, options }),
    updateLocation: (
      locationId: string,
      body: z.input<typeof locationUpdateRequestSchema>,
      options?: RequestOptions,
    ) => call(contentEndpoints.updateLocation, { params: { locationId }, body, options }),
    deleteLocation: (locationId: string, options?: RequestOptions) =>
      call(contentEndpoints.deleteLocation, { params: { locationId }, options }),
  };
}

function createContentTemplateApi(call: Requester) {
  return {
    listTemplates: (options?: RequestOptions) => call(contentEndpoints.listTemplates, { options }),
    previewTemplate: (body: z.input<typeof templatePreviewRequestSchema>, options?: RequestOptions) =>
      call(contentEndpoints.previewTemplate, { body, options }),
    upsertTemplate: (body: z.input<typeof templateUpsertRequestSchema>, options?: RequestOptions) =>
      call(contentEndpoints.upsertTemplate, { body, options }),
    deleteTemplate: (templateId: string, options?: RequestOptions) =>
      call(contentEndpoints.deleteTemplate, { params: { templateId }, options }),
  };
}

function createContentRatesApi(call: Requester) {
  return {
    listRateEntries: (options?: RequestOptions) =>
      call(contentEndpoints.listRateEntries, { options }),
    upsertRateEntry: (body: z.input<typeof rateEntryUpsertRequestSchema>, options?: RequestOptions) =>
      call(contentEndpoints.upsertRateEntry, { body, options }),
    deleteRateEntry: (entryId: string, options?: RequestOptions) =>
      call(contentEndpoints.deleteRateEntry, { params: { entryId }, options }),
  };
}

export type ContentApi = ReturnType<typeof createContentApi>;
