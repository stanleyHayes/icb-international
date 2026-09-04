import type { CurrencyCode } from '@icb/money';

/** The currency headline reports default to when the caller does not specify one. */
export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'USD';

/** Matches internal general-ledger account references (`gl:2000`, …) in query filters. */
export const GL_REF_PATTERN = '^gl:';

/** Matches customer sub-ledger account references (`acct:01J8ZC…`) in query filters. */
export const CUSTOMER_REF_PATTERN = '^acct:';

/** Length of the `acct:` prefix, for slicing the account id back out of a reference. */
export const CUSTOMER_REF_PREFIX_LENGTH = 'acct:'.length;
