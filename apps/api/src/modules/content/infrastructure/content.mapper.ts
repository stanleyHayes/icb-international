import type {
  ContentLocationView,
  FaqArticleView,
  RateEntryView,
  TemplateOverrideView,
} from '@icb/contracts';

import type {
  ContentArticleDoc,
  ContentLocationDoc,
  ContentRateEntryDoc,
  ContentTemplateOverrideDoc,
} from './content.schemas.js';

/** Document → wire view. Dates serialise to ISO here so no service repeats the mapping. */

export function toFaqArticleView(doc: ContentArticleDoc): FaqArticleView {
  return {
    id: doc._id,
    title: doc.title,
    slug: doc.slug,
    category: doc.category,
    body: doc.body,
    published: doc.published,
    ordering: doc.ordering,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toLocationView(doc: ContentLocationDoc): ContentLocationView {
  return {
    id: doc._id,
    name: doc.name,
    type: doc.type as ContentLocationView['type'],
    address: {
      line1: doc.address.line1,
      line2: doc.address.line2 ?? undefined,
      city: doc.address.city,
      region: doc.address.region ?? undefined,
      postalCode: doc.address.postalCode ?? undefined,
      country: doc.address.country,
    },
    latitude: doc.latitude,
    longitude: doc.longitude,
    hours: doc.hours,
    services: doc.services,
    active: doc.active,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toTemplateOverrideView(doc: ContentTemplateOverrideDoc): TemplateOverrideView {
  return {
    id: doc._id,
    key: doc.key,
    channel: doc.channel as TemplateOverrideView['channel'],
    subject: doc.subject,
    body: doc.body,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toRateEntryView(doc: ContentRateEntryDoc): RateEntryView {
  return {
    id: doc._id,
    productCode: doc.productCode,
    name: doc.name,
    rate: doc.rate,
    effectiveFrom: doc.effectiveFrom.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
