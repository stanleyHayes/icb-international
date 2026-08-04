import type { ExportFormat } from '@icb/contracts';

/**
 * Entry statuses that count towards a balance. Anything earlier in the lifecycle is a
 * intention, not a fact, so it shows in the list but never moves the running balance.
 */
export const SETTLED_STATUSES = ['posted', 'settled'] as const;

/** How long a minted export download link stays valid. */
export const EXPORT_LINK_TTL_SECONDS = 300;

/** Hard cap on rows in one export, so a hostile date range cannot exhaust memory. */
export const MAX_EXPORT_ROWS = 5_000;

export const EXPORT_CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  csv: 'text/csv; charset=utf-8',
  ofx: 'application/x-ofx',
  pdf: 'application/pdf',
  json: 'application/json',
};

export const EXPORT_EXTENSIONS: Readonly<Record<ExportFormat, string>> = {
  csv: 'csv',
  ofx: 'ofx',
  pdf: 'pdf',
  json: 'json',
};

/** Spend analytics defaults when the caller does not bound the window. */
export const ANALYTICS_DEFAULT_PERIOD_DAYS = 30;

/** How many merchants the leaderboard returns — the head of the list, not the tail. */
export const MERCHANT_ANALYTICS_LIMIT = 10;

/** Recurring-charge detection looks back this far: monthly charges need months of runway. */
export const RECURRING_LOOKBACK_DAYS = 180;

/** Cashflow always reports this many buckets, ending in the current one. */
export const CASHFLOW_PERIOD_COUNT = 12;

/** A host bound to all interfaces is unreachable from a browser; links must name localhost. */
const WILDCARD_HOST = '0.0.0.0';

/** Base URL download links are minted against — the API itself serves export bytes. */
export function apiBaseUrl(http: { host: string; port: number }): string {
  const host = http.host === WILDCARD_HOST ? 'localhost' : http.host;
  return `http://${host}:${String(http.port)}`;
}
