/**
 * Currency registry.
 *
 * `scale` is the number of decimal places the currency has. It is NOT always 2 —
 * JPY has 0, KWD/BHD/JOD have 3. Every conversion between a human-readable decimal and the
 * integer minor units the ledger stores goes through this table, so getting it wrong here
 * corrupts balances everywhere.
 */

export const CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'GHS',
  'NGN',
  'KES',
  'ZAR',
  'CAD',
  'AUD',
  'CHF',
  'JPY',
  'CNY',
  'INR',
  'AED',
  'KWD',
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly symbol: string;
  /** Decimal places. USD=2, JPY=0, KWD=3. */
  readonly scale: number;
  readonly numericCode: string;
}

const DEFINITIONS: Readonly<Record<CurrencyCode, CurrencyDefinition>> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', scale: 2, numericCode: '840' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', scale: 2, numericCode: '978' },
  GBP: { code: 'GBP', name: 'Pound Sterling', symbol: '£', scale: 2, numericCode: '826' },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', scale: 2, numericCode: '936' },
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', scale: 2, numericCode: '566' },
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', scale: 2, numericCode: '404' },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', scale: 2, numericCode: '710' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', scale: 2, numericCode: '124' },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', scale: 2, numericCode: '036' },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', scale: 2, numericCode: '756' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', scale: 0, numericCode: '392' },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥', scale: 2, numericCode: '156' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', scale: 2, numericCode: '356' },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', scale: 2, numericCode: '784' },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', scale: 3, numericCode: '414' },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in DEFINITIONS;
}

export function getCurrency(code: CurrencyCode): CurrencyDefinition {
  const definition = DEFINITIONS[code];
  /* c8 ignore next 3 — unreachable while `code` is typed, guards runtime boundary input. */
  if (!definition) {
    throw new Error(`Unknown currency code: ${String(code)}`);
  }
  return definition;
}

export function getScale(code: CurrencyCode): number {
  return getCurrency(code).scale;
}

/** 10 ** scale, e.g. 100 for USD. Precomputed to avoid repeated exponentiation in hot paths. */
export function getMinorUnitFactor(code: CurrencyCode): number {
  return 10 ** getScale(code);
}

export function listCurrencies(): readonly CurrencyDefinition[] {
  return CURRENCY_CODES.map((code) => DEFINITIONS[code]);
}
