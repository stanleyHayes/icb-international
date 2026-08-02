/**
 * Constants for the OpenAPI build. No literal may live in a route table — every repeated
 * vocabulary (tags, media types, header names, status codes) is declared here once.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Repository root — `scripts/openapi/` is four levels deep. */
export const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

/** The committed artifact this build owns. */
export const OPENAPI_OUTPUT_FILE = path.join(REPO_ROOT, 'docs', 'api', 'openapi.json');

export const OPENAPI_VERSION = '3.1.0';

export const API_TITLE = 'ICB API';
export const API_VERSION = '1.0.0';
export const API_DESCRIPTION = [
  'International Commercial Bank — retail and commercial banking API.',
  'All routes are versioned under `/v1`. Money is always an integer of minor units',
  '(`{ minorUnits, currency, scale }`). Every non-2xx response is an RFC 9457',
  '`application/problem+json` document carrying a stable `code` from the contract error',
  'taxonomy. Mutating money endpoints require an `Idempotency-Key` header and replay',
  'the original response on retry. Authenticated routes expect a short-lived Bearer JWT;',
  'the refresh token lives in an httpOnly cookie.',
].join(' ');

export const SERVER_URL = 'http://localhost:4100/v1';
export const SERVER_DESCRIPTION = 'Local development';

export const JSON_MEDIA_TYPE = 'application/json';
export const PROBLEM_MEDIA_TYPE = 'application/problem+json';

export const BEARER_SCHEME_NAME = 'bearerAuth';
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** One tag per bounded context. Operations are grouped in the emitted document by these. */
export const TAG = {
  auth: 'Auth',
  customers: 'Customers',
  kyc: 'KYC',
  accounts: 'Accounts',
  transactions: 'Transactions',
  transfers: 'Transfers',
  beneficiaries: 'Beneficiaries',
  cards: 'Cards',
  lending: 'Lending',
  savings: 'Savings',
  payments: 'Payments',
  products: 'Products & Rates',
  documents: 'Documents',
  notifications: 'Notifications',
  support: 'Support',
  disputes: 'Disputes',
  risk: 'Risk & Compliance',
  governance: 'Governance',
  admin: 'Admin',
  simulation: 'Simulation',
  system: 'System',
} as const;

export type TagName = (typeof TAG)[keyof typeof TAG];

/** HTTP status codes used by the route tables, named so tables contain no bare numbers. */
export const STATUS = {
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  locked: 423,
  tooManyRequests: 429,
  internalError: 500,
  serviceUnavailable: 503,
} as const;

export type StatusCode = (typeof STATUS)[keyof typeof STATUS];

/** Default prose for each error status. An operation may override per occurrence. */
export const ERROR_DESCRIPTIONS: Readonly<Partial<Record<StatusCode, string>>> = {
  [STATUS.unauthorized]: 'Missing, expired, or insufficient credentials (includes step-up).',
  [STATUS.forbidden]: 'The authenticated principal may not perform this action.',
  [STATUS.notFound]: 'The requested resource does not exist.',
  [STATUS.conflict]: 'The request conflicts with current state or a processed idempotency key.',
  [STATUS.unprocessable]: 'The request is well-formed but fails validation or a business rule.',
  [STATUS.locked]: 'The account is locked after repeated failed attempts.',
  [STATUS.tooManyRequests]: 'Rate limit exceeded. Retry after `retryAfterSeconds`.',
  [STATUS.internalError]: 'An unexpected server error.',
  [STATUS.serviceUnavailable]: 'A dependency is temporarily unavailable. Safe to retry.',
};
