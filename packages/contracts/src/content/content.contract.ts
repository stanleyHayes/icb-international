import { z } from 'zod';

import { notificationChannelSchema } from '../common/enums.js';
import { addressSchema, idSchema, isoDateTimeSchema } from '../common/primitives.js';

/**
 * Content management (agent_plan.md ADM-15): FAQ/help articles, branch & ATM records,
 * notification template overrides, and marketing rate-table entries.
 *
 * The staff surface (`/admin/content/*`) mutates these; the public surface
 * (`/content/faq|locations|rates`) serves only published articles and active locations.
 */

/** Field bounds shared by the content request schemas. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
export const PRODUCT_CODE_PATTERN = /^[a-z0-9-]+$/;
export const MAX_ORDERING = 9999;
export const DEFAULT_ORDERING = 100;
export const MAX_RATE_PERCENT = 100;
export const MAX_SERVICES_PER_LOCATION = 20;

const slugSchema = z.string().regex(SLUG_PATTERN, 'Expected a URL-safe slug').max(140);

// ---- FAQ articles -----------------------------------------------------------

export const faqCreateRequestSchema = z.object({
  title: z.string().min(2).max(120),
  /** Omit to derive the slug from the title. */
  slug: slugSchema.optional(),
  category: z.string().min(1).max(60),
  body: z.string().min(1).max(20000),
  published: z.boolean().default(false),
  ordering: z.int().min(0).max(MAX_ORDERING).default(DEFAULT_ORDERING),
});

export const faqUpdateRequestSchema = faqCreateRequestSchema.partial();

export const faqQuerySchema = z.object({
  category: z.string().min(1).max(60).optional(),
});

export const faqArticleViewSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  category: z.string(),
  body: z.string(),
  published: z.boolean(),
  ordering: z.int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

// ---- Branches & ATMs ---------------------------------------------------------

export const locationCreateRequestSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['branch', 'atm']),
  address: addressSchema,
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  hours: z.string().max(500).default(''),
  services: z.array(z.string().min(1).max(60)).max(MAX_SERVICES_PER_LOCATION).default([]),
  active: z.boolean().default(true),
});

export const locationUpdateRequestSchema = locationCreateRequestSchema.partial();

export const contentLocationViewSchema = z.object({
  id: idSchema,
  name: z.string(),
  type: z.enum(['branch', 'atm']),
  address: addressSchema,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  hours: z.string(),
  services: z.array(z.string()),
  active: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

// ---- Notification template overrides ------------------------------------------

export const templateUpsertRequestSchema = z.object({
  key: z.string().regex(TEMPLATE_KEY_PATTERN, 'Expected a template key').max(80),
  channel: notificationChannelSchema,
  /** Empty for channels without a subject line (sms, push, in_app). */
  subject: z.string().max(200).default(''),
  body: z.string().min(1).max(8000),
});

export const templatePreviewRequestSchema = templateUpsertRequestSchema.extend({
  /** Extra facts layered over the built-in sample. */
  sample: z.record(z.string().max(40), z.string().max(500)).optional(),
});

export const templateOverrideViewSchema = z.object({
  id: idSchema,
  key: z.string(),
  channel: notificationChannelSchema,
  subject: z.string(),
  body: z.string(),
  updatedBy: z.string(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const templatePreviewResultSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

// ---- Marketing rate-table entries ----------------------------------------------

export const rateEntryUpsertRequestSchema = z.object({
  productCode: z.string().regex(PRODUCT_CODE_PATTERN, 'Expected a product code').max(40),
  name: z.string().min(2).max(80),
  rate: z.number().min(0).max(MAX_RATE_PERCENT),
  effectiveFrom: isoDateTimeSchema,
});

export const rateEntryViewSchema = z.object({
  id: idSchema,
  productCode: z.string(),
  name: z.string(),
  rate: z.number(),
  effectiveFrom: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type FaqCreateRequest = z.infer<typeof faqCreateRequestSchema>;
export type FaqUpdateRequest = z.infer<typeof faqUpdateRequestSchema>;
export type FaqQuery = z.infer<typeof faqQuerySchema>;
export type FaqArticleView = z.infer<typeof faqArticleViewSchema>;
export type LocationCreateRequest = z.infer<typeof locationCreateRequestSchema>;
export type LocationUpdateRequest = z.infer<typeof locationUpdateRequestSchema>;
export type ContentLocationView = z.infer<typeof contentLocationViewSchema>;
export type TemplateUpsertRequest = z.infer<typeof templateUpsertRequestSchema>;
export type TemplatePreviewRequest = z.infer<typeof templatePreviewRequestSchema>;
export type TemplateOverrideView = z.infer<typeof templateOverrideViewSchema>;
export type TemplatePreviewResult = z.infer<typeof templatePreviewResultSchema>;
export type RateEntryUpsertRequest = z.infer<typeof rateEntryUpsertRequestSchema>;
export type RateEntryView = z.infer<typeof rateEntryViewSchema>;
