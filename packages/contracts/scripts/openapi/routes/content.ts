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
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const ARTICLE_ID = { articleId: idSchema } as const;
const LOCATION_ID = { locationId: idSchema } as const;
const TEMPLATE_ID = { templateId: idSchema } as const;
const ENTRY_ID = { entryId: idSchema } as const;

const NOT_FOUND = { status: STATUS.notFound } as const;
const INVALID = { status: STATUS.unprocessable } as const;

export const contentOperations = defineOperations([
  // ---- Public surface (no token — the marketing site reads these anonymously) ----
  {
    method: 'get',
    path: '/content/faq',
    tag: TAG.content,
    operationId: 'listPublishedFaq',
    summary: 'Published FAQ articles, optionally filtered by category',
    query: faqQuerySchema,
    response: success(STATUS.ok, 'The published articles.', z.array(faqArticleViewSchema)),
    auth: false,
  },
  {
    method: 'get',
    path: '/content/locations',
    tag: TAG.content,
    operationId: 'listActiveLocations',
    summary: 'Active branches and ATMs',
    response: success(STATUS.ok, 'The active locations.', z.array(contentLocationViewSchema)),
    auth: false,
  },
  {
    method: 'get',
    path: '/content/rates',
    tag: TAG.content,
    operationId: 'getLayeredRateTable',
    summary: 'The catalogue rate table with content-managed entries layered over it',
    response: success(STATUS.ok, 'The layered rate table.', rateTableSchema),
    auth: false,
  },

  // ---- Staff surface: FAQ articles ----
  {
    method: 'get',
    path: '/admin/content/faq',
    tag: TAG.content,
    operationId: 'listFaqArticles',
    summary: 'All FAQ articles, drafts included (staff)',
    response: success(STATUS.ok, 'Every article.', z.array(faqArticleViewSchema)),
  },
  {
    method: 'post',
    path: '/admin/content/faq',
    tag: TAG.content,
    operationId: 'createFaqArticle',
    summary: 'Create a FAQ article (staff)',
    request: faqCreateRequestSchema,
    response: success(STATUS.created, 'The created article.', faqArticleViewSchema),
    errors: [INVALID],
  },
  {
    method: 'patch',
    path: '/admin/content/faq/{articleId}',
    tag: TAG.content,
    operationId: 'updateFaqArticle',
    summary: 'Update a FAQ article (staff)',
    pathParams: ARTICLE_ID,
    request: faqUpdateRequestSchema,
    response: success(STATUS.ok, 'The updated article.', faqArticleViewSchema),
    errors: [NOT_FOUND, INVALID],
  },
  {
    method: 'delete',
    path: '/admin/content/faq/{articleId}',
    tag: TAG.content,
    operationId: 'deleteFaqArticle',
    summary: 'Delete a FAQ article (staff)',
    pathParams: ARTICLE_ID,
    response: success(STATUS.noContent, 'The article was deleted.'),
    errors: [NOT_FOUND],
  },

  // ---- Staff surface: branches & ATMs ----
  {
    method: 'get',
    path: '/admin/content/locations',
    tag: TAG.content,
    operationId: 'listContentLocations',
    summary: 'All branches and ATMs, inactive included (staff)',
    response: success(STATUS.ok, 'Every location.', z.array(contentLocationViewSchema)),
  },
  {
    method: 'post',
    path: '/admin/content/locations',
    tag: TAG.content,
    operationId: 'createContentLocation',
    summary: 'Create a branch or ATM (staff)',
    request: locationCreateRequestSchema,
    response: success(STATUS.created, 'The created location.', contentLocationViewSchema),
    errors: [INVALID],
  },
  {
    method: 'patch',
    path: '/admin/content/locations/{locationId}',
    tag: TAG.content,
    operationId: 'updateContentLocation',
    summary: 'Update a branch or ATM (staff)',
    pathParams: LOCATION_ID,
    request: locationUpdateRequestSchema,
    response: success(STATUS.ok, 'The updated location.', contentLocationViewSchema),
    errors: [NOT_FOUND, INVALID],
  },
  {
    method: 'delete',
    path: '/admin/content/locations/{locationId}',
    tag: TAG.content,
    operationId: 'deleteContentLocation',
    summary: 'Delete a branch or ATM (staff)',
    pathParams: LOCATION_ID,
    response: success(STATUS.noContent, 'The location was deleted.'),
    errors: [NOT_FOUND],
  },

  // ---- Staff surface: notification template overrides ----
  {
    method: 'get',
    path: '/admin/content/templates',
    tag: TAG.content,
    operationId: 'listTemplateOverrides',
    summary: 'All notification template overrides (staff)',
    response: success(STATUS.ok, 'Every override.', z.array(templateOverrideViewSchema)),
  },
  {
    method: 'post',
    path: '/admin/content/templates/preview',
    tag: TAG.content,
    operationId: 'previewTemplate',
    summary: 'Render candidate copy against sample data; a read-only render (staff)',
    request: templatePreviewRequestSchema,
    response: success(STATUS.ok, 'The rendered subject and body.', templatePreviewResultSchema),
    errors: [INVALID],
  },
  {
    method: 'post',
    path: '/admin/content/templates',
    tag: TAG.content,
    operationId: 'upsertTemplateOverride',
    summary: 'Create or replace the override for a (key, channel) pair (staff)',
    request: templateUpsertRequestSchema,
    response: success(STATUS.created, 'The saved override.', templateOverrideViewSchema),
    errors: [INVALID],
  },
  {
    method: 'delete',
    path: '/admin/content/templates/{templateId}',
    tag: TAG.content,
    operationId: 'deleteTemplateOverride',
    summary: 'Delete a template override (staff)',
    pathParams: TEMPLATE_ID,
    response: success(STATUS.noContent, 'The override was deleted.'),
    errors: [NOT_FOUND],
  },

  // ---- Staff surface: marketing rate-table entries ----
  {
    method: 'get',
    path: '/admin/content/rates',
    tag: TAG.content,
    operationId: 'listRateEntries',
    summary: 'All marketing rate-table entries (staff)',
    response: success(STATUS.ok, 'Every entry.', z.array(rateEntryViewSchema)),
  },
  {
    method: 'post',
    path: '/admin/content/rates',
    tag: TAG.content,
    operationId: 'upsertRateEntry',
    summary: 'Create or replace the entry for a product code (staff)',
    request: rateEntryUpsertRequestSchema,
    response: success(STATUS.created, 'The saved entry.', rateEntryViewSchema),
    errors: [INVALID],
  },
  {
    method: 'delete',
    path: '/admin/content/rates/{entryId}',
    tag: TAG.content,
    operationId: 'deleteRateEntry',
    summary: 'Delete a rate-table entry (staff)',
    pathParams: ENTRY_ID,
    response: success(STATUS.noContent, 'The entry was deleted.'),
    errors: [NOT_FOUND],
  },
]);
