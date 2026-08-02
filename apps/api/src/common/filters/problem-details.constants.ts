import type { ErrorCode } from '@icb/contracts';

/** Base URI for RFC 9457 problem `type` references. */
export const PROBLEM_TYPE_BASE = 'https://icb.example/problems';

export const TITLES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'Not permitted',
  CONFLICT: 'Conflicting state',
  RATE_LIMITED: 'Too many requests',
  INTERNAL_ERROR: 'Something went wrong',
};

/** Framework exceptions arrive with a status but no ICB code; this maps one to the other. */
export const STATUS_CODES: Readonly<Record<number, ErrorCode>> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

export function codeForStatus(status: number): ErrorCode {
  return STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED');
}

export function titleFor(code: ErrorCode): string {
  return TITLES[code] ?? code.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}
