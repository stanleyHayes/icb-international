import { z } from 'zod';

/**
 * Every failure the API can return, as a closed set.
 *
 * Clients switch on `code`, never on `detail` — the prose is for humans and may be reworded at
 * any time. Adding a code is a contract change and goes through SDK-01.
 */
export const ERROR_CODES = [
  // ---- Generic -------------------------------------------------------------
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'IDEMPOTENCY_KEY_REUSED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',

  // ---- Authentication ------------------------------------------------------
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'EMAIL_NOT_VERIFIED',
  'MFA_REQUIRED',
  'MFA_INVALID',
  'STEP_UP_REQUIRED',
  'SESSION_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'PASSWORD_POLICY_VIOLATION',

  // ---- Customer / KYC ------------------------------------------------------
  'CUSTOMER_SUSPENDED',
  'KYC_REQUIRED',
  'KYC_TIER_INSUFFICIENT',
  'KYC_DOCUMENT_REJECTED',

  // ---- Accounts ------------------------------------------------------------
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_FROZEN',
  'ACCOUNT_CLOSED',
  'ACCOUNT_NOT_EMPTY',
  'ACCOUNT_CURRENCY_MISMATCH',

  // ---- Money movement ------------------------------------------------------
  'INSUFFICIENT_FUNDS',
  'LIMIT_EXCEEDED',
  'AMOUNT_BELOW_MINIMUM',
  'TRANSFER_NOT_CANCELLABLE',
  'BENEFICIARY_UNVERIFIED',
  'BENEFICIARY_COOLING_OFF',
  'RAIL_UNAVAILABLE',
  'RAIL_REJECTED',
  'CUT_OFF_PASSED',
  'DUPLICATE_TRANSFER',
  'QUOTE_EXPIRED',
  'QUOTE_ALREADY_USED',

  // ---- Ledger --------------------------------------------------------------
  'LEDGER_UNBALANCED',
  'LEDGER_ENTRY_IMMUTABLE',
  'TRANSACTION_ALREADY_REVERSED',
  'HOLD_ALREADY_RELEASED',

  // ---- Cards ---------------------------------------------------------------
  'CARD_NOT_FOUND',
  'CARD_BLOCKED',
  'CARD_EXPIRED',
  'CARD_CONTROL_DECLINED',
  'PIN_POLICY_VIOLATION',

  // ---- Lending -------------------------------------------------------------
  'LOAN_NOT_ELIGIBLE',
  'LOAN_APPLICATION_CLOSED',
  'LOAN_ALREADY_SETTLED',
  'REPAYMENT_EXCEEDS_BALANCE',

  // ---- Risk / compliance ---------------------------------------------------
  'RISK_BLOCKED',
  'RISK_REVIEW_REQUIRED',
  'SANCTIONS_HIT',

  // ---- Back office ---------------------------------------------------------
  'APPROVAL_REQUIRED',
  'SELF_APPROVAL_FORBIDDEN',
  'APPROVAL_EXPIRED',
  'PERMISSION_DENIED',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = (typeof ERROR_CODES)[number];

/** A single field-level validation failure. */
export const fieldErrorSchema = z.object({
  /** Dot/bracket path into the request body, e.g. `beneficiary.accountNumber`. */
  path: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

/**
 * RFC 9457 problem details, extended with the ICB error code and correlation id.
 *
 * Every non-2xx response in the API has exactly this shape — there is no second error format.
 */
export const problemDetailsSchema = z.object({
  type: z.url().describe('URI reference identifying the problem type'),
  title: z.string().describe('Short, human-readable summary'),
  status: z.int().min(400).max(599),
  detail: z.string().describe('Human-readable explanation specific to this occurrence'),
  instance: z.string().optional().describe('URI reference for this specific occurrence'),
  code: errorCodeSchema,
  correlationId: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
  /** Present on 429 and on rail failures that are worth retrying. */
  retryAfterSeconds: z.int().positive().optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Maps each code to the HTTP status the API returns for it. */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  IDEMPOTENCY_KEY_REUSED: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,

  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  EMAIL_NOT_VERIFIED: 403,
  MFA_REQUIRED: 401,
  MFA_INVALID: 401,
  STEP_UP_REQUIRED: 401,
  SESSION_EXPIRED: 401,
  REFRESH_TOKEN_REUSED: 401,
  PASSWORD_POLICY_VIOLATION: 422,

  CUSTOMER_SUSPENDED: 403,
  KYC_REQUIRED: 403,
  KYC_TIER_INSUFFICIENT: 403,
  KYC_DOCUMENT_REJECTED: 422,

  ACCOUNT_NOT_FOUND: 404,
  ACCOUNT_FROZEN: 409,
  ACCOUNT_CLOSED: 409,
  ACCOUNT_NOT_EMPTY: 409,
  ACCOUNT_CURRENCY_MISMATCH: 422,

  INSUFFICIENT_FUNDS: 422,
  LIMIT_EXCEEDED: 422,
  AMOUNT_BELOW_MINIMUM: 422,
  TRANSFER_NOT_CANCELLABLE: 409,
  BENEFICIARY_UNVERIFIED: 409,
  BENEFICIARY_COOLING_OFF: 409,
  RAIL_UNAVAILABLE: 503,
  RAIL_REJECTED: 422,
  CUT_OFF_PASSED: 409,
  DUPLICATE_TRANSFER: 409,
  QUOTE_EXPIRED: 409,
  QUOTE_ALREADY_USED: 409,

  LEDGER_UNBALANCED: 500,
  LEDGER_ENTRY_IMMUTABLE: 409,
  TRANSACTION_ALREADY_REVERSED: 409,
  HOLD_ALREADY_RELEASED: 409,

  CARD_NOT_FOUND: 404,
  CARD_BLOCKED: 409,
  CARD_EXPIRED: 409,
  CARD_CONTROL_DECLINED: 422,
  PIN_POLICY_VIOLATION: 422,

  LOAN_NOT_ELIGIBLE: 422,
  LOAN_APPLICATION_CLOSED: 409,
  LOAN_ALREADY_SETTLED: 409,
  REPAYMENT_EXCEEDS_BALANCE: 422,

  RISK_BLOCKED: 403,
  RISK_REVIEW_REQUIRED: 202,
  SANCTIONS_HIT: 403,

  APPROVAL_REQUIRED: 202,
  SELF_APPROVAL_FORBIDDEN: 403,
  APPROVAL_EXPIRED: 409,
  PERMISSION_DENIED: 403,
};
