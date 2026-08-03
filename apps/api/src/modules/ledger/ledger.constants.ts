import type { CurrencyCode } from '@icb/money';

/** The currency headline reports default to when the caller does not specify one. */
export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'USD';

/** Matches internal general-ledger account references (`gl:2000`, …) in query filters. */
export const GL_REF_PATTERN = '^gl:';
