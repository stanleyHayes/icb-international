import type { SelfServeProduct } from './domain/product-catalogue.js';

/** ICB's institution code inside an IBAN. */
export const BANK_CODE = 'ICBK';

/** Attempts to allocate a collision-free account number before giving up. */
export const ACCOUNT_NUMBER_RETRY_ATTEMPTS = 5;

/**
 * Per-customer account limits, enforced when a customer opens an account through the API.
 *
 * Internal openings (fixed deposits, loan disbursement accounts) are not capped — a customer
 * with twenty term deposits has twenty deposit accounts by design. The caps exist for the
 * self-serve path, where an unlimited `POST /accounts` is an operational and fraud nuisance.
 */
export const ACCOUNT_LIMITS = {
  /** One self-serve account per product in a given currency. */
  maxPerProductCurrency: 1,
  /** Total non-closed accounts a customer may hold. */
  maxActivePerCustomer: 10,
} as const;

/** Balance-history defaults: a quarter back, at most a year, so chart queries stay bounded. */
export const BALANCE_HISTORY_DEFAULT_DAYS = 90;
export const BALANCE_HISTORY_MAX_DAYS = 366;

/**
 * The products a customer can self-serve open.
 *
 * This is the bridge until BE-08 (products & pricing) lands a `products` collection; the values
 * mirror the seed catalogue so an account opened here is indistinguishable from a seeded one.
 */
export const SELF_SERVE_PRODUCTS: readonly SelfServeProduct[] = [
  {
    code: 'ICB-CURRENT',
    name: 'ICB Everyday Current',
    kind: 'current',
    interestRate: 0.25,
    overdraftMinorUnits: 50_000,
  },
  {
    code: 'ICB-SAVINGS',
    name: 'ICB Reserve Savings',
    kind: 'savings',
    interestRate: 4.15,
    overdraftMinorUnits: 0,
  },
];
