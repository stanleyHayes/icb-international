import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '@icb/contracts';

/** Search params as Next hands them to a page: each key may be single, repeated, or absent. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export const TRANSACTION_PAGE_SIZE = 25;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function filterAllowed(values: string[], allowed: readonly string[]): string[] {
  return values.filter((value) => allowed.includes(value));
}

/**
 * Appends an array filter as repeated keys.
 *
 * The API validates these facets with `z.array(...)`, and its querystring parser only produces
 * an array for a repeated key — one value arrives as a bare string and fails validation with a
 * 422. Repeating a single value keeps it an array; the filter treats duplicates as a set.
 */
function appendArrayParam(params: URLSearchParams, key: string, values: string[]): void {
  const repeated = values.length === 1 ? [values[0] as string, values[0] as string] : values;
  for (const value of repeated) params.append(key, value);
}

/** Major units as typed ("120.50") to minor units. Returns null when not a valid amount. */
export function amountToMinorUnits(value: string | undefined): number | null {
  if (!value) return null;
  const major = Number(value);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

/**
 * Turns URL search params into the API query string for GET /transactions.
 *
 * Every value is validated here — against the contract enums for facets and against shape for
 * dates and amounts — so a hand-edited URL narrows the list or is ignored, but can never make
 * the API reject the whole page with a 422.
 */
export function buildTransactionsQuery(raw: RawSearchParams, limit: number): string {
  const params = new URLSearchParams({ limit: String(limit) });
  appendFacetParams(params, raw);
  appendRangeParams(params, raw);
  return params.toString();
}

/** Search, direction, and the enum-validated array facets. */
function appendFacetParams(params: URLSearchParams, raw: RawSearchParams): void {
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  if (q) params.set('q', q.slice(0, 120));

  if (raw.direction === 'debit' || raw.direction === 'credit') {
    params.set('direction', raw.direction);
  }
  appendArrayParam(params, 'type', filterAllowed(asArray(raw.type), TRANSACTION_TYPES));
  appendArrayParam(params, 'status', filterAllowed(asArray(raw.status), TRANSACTION_STATUSES));
  appendArrayParam(params, 'category', filterAllowed(asArray(raw.category), TRANSACTION_CATEGORIES));

  if (typeof raw.account === 'string' && raw.account) params.set('accountId', raw.account);
}

/** Date window and amount range, validated to ISO dates and non-negative minor units. */
function appendRangeParams(params: URLSearchParams, raw: RawSearchParams): void {
  if (typeof raw.from === 'string' && ISO_DATE.test(raw.from)) params.set('from', raw.from);
  if (typeof raw.to === 'string' && ISO_DATE.test(raw.to)) params.set('to', raw.to);

  const min = amountToMinorUnits(typeof raw.minAmount === 'string' ? raw.minAmount : undefined);
  const max = amountToMinorUnits(typeof raw.maxAmount === 'string' ? raw.maxAmount : undefined);
  if (min !== null) params.set('minMinorUnits', String(min));
  if (max !== null) params.set('maxMinorUnits', String(max));
}

/** One filter's current value, for pre-filling the filter bar from the URL. */
export function singleValue(raw: RawSearchParams, key: string): string | null {
  const value = raw[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
