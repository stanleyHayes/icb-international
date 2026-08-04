import type { StaffRole } from '@icb/contracts';

/**
 * Roles allowed to manage content. Mirrors the console nav entry for /content — the sidebar
 * hides the door from exactly the roles this guard would turn away.
 */
export const CONTENT_STAFF_ROLES: readonly StaffRole[] = ['admin', 'super_admin'];

/** Cache for the layered public rate table. */
export const CONTENT_CACHE_NAMESPACE = 'content';
export const RATE_TABLE_CACHE_KEY = 'rate-table';
export const RATE_TABLE_TTL_SECONDS = 300;

/**
 * Fallback facts for template previews. Staff may override any key with their own sample;
 * `occurredAt` is always clock-derived and merged in by the service, never taken from the form.
 */
export const DEFAULT_TEMPLATE_SAMPLE: Readonly<Record<string, string>> = {
  bankName: 'ICB',
  recipientName: 'Amara',
  amount: '1,250.00',
  currency: 'GHS',
  productName: 'Everyday Savings',
  reference: 'TRF-8F3K2M9Q',
};
