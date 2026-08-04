import type { LucideIcon } from 'lucide-react';
import type { Route } from 'next';

/**
 * The full copy for one product detail page.
 *
 * Extends the overview shape in `content/products.ts` with the sections only a detail page
 * carries: an eligibility snapshot, the application journey and product-specific FAQs. Same
 * rule applies — a figure appears in exactly one place, and rates match the API's catalogue.
 */
export interface ProductPageCopy {
  readonly category: 'Personal' | 'Business' | 'Wealth';
  readonly categoryHref: Route;
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly metaDescription: string;
  readonly heroLead: string;
  readonly headline: string;
  readonly headlineNote: string;
  readonly features: readonly ProductPageFeature[];
  readonly rates: readonly ProductPageRate[];
  readonly eligibility: readonly string[];
  readonly faqs: readonly ProductPageFaq[];
}

export interface ProductPageFeature {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}

export interface ProductPageRate {
  readonly label: string;
  readonly value: string;
}

export interface ProductPageStep {
  readonly title: string;
  readonly body: string;
}

export interface ProductPageFaq {
  readonly question: string;
  readonly answer: string;
}

/** The retail application journey, shared by every personal and wealth product page. */
export const RETAIL_STEPS: readonly ProductPageStep[] = [
  {
    title: 'Apply online',
    body: 'About ten minutes, from any device. Save part-way and come back whenever you like.',
  },
  {
    title: 'Verify your identity',
    body: 'A photo of your ID and a short liveness check, reviewed within one business day.',
  },
  {
    title: 'Start using it',
    body: 'Your product is opened and ready the moment verification clears — no branch visit.',
  },
] as const;

/** The business application journey, shared by every business product page. */
export const BUSINESS_STEPS: readonly ProductPageStep[] = [
  {
    title: 'Tell us about the business',
    body: 'Company details, ownership structure and what you expect to use the account for.',
  },
  {
    title: 'Verify the people',
    body: 'Every director and significant owner completes ID and liveness checks online.',
  },
  {
    title: 'Get to work',
    body: 'Most applications are decided within two business days, with the reasoning shown.',
  },
] as const;
