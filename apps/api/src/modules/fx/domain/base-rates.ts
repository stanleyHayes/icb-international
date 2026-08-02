import type { CurrencyCode } from '@icb/money';

/**
 * The anchor table: US dollars per one unit of each currency.
 *
 * Storing one column against a single numeraire rather than 210 pairs means every cross rate is
 * arithmetically consistent by construction — EUR/GBP × GBP/USD is exactly EUR/USD, so a
 * triangular arbitrage cannot appear in a demo and make the bank look broken.
 *
 * The numbers are plausible rather than live. Nothing here reaches the internet.
 */
export const USD_PER_UNIT: Readonly<Record<CurrencyCode, number>> = {
  USD: 1,
  EUR: 1.0842,
  GBP: 1.2685,
  GHS: 0.0645,
  NGN: 0.00065,
  KES: 0.0077,
  ZAR: 0.0545,
  CAD: 0.732,
  AUD: 0.6605,
  CHF: 1.124,
  JPY: 0.0067,
  CNY: 0.1385,
  INR: 0.012,
  AED: 0.2723,
  KWD: 3.262,
};

/**
 * How far each currency wanders, as a fraction of its anchor.
 *
 * Pegged currencies barely move (the dirham's band against the dollar is a policy commitment,
 * not a market outcome), frontier currencies move a lot, and the dollar itself drifts so that
 * every pair has two sides in motion rather than one.
 */
export const VOLATILITY: Readonly<Record<CurrencyCode, number>> = {
  USD: 0.008,
  EUR: 0.012,
  GBP: 0.014,
  GHS: 0.038,
  NGN: 0.045,
  KES: 0.028,
  ZAR: 0.032,
  CAD: 0.011,
  AUD: 0.016,
  CHF: 0.01,
  JPY: 0.018,
  CNY: 0.009,
  INR: 0.013,
  AED: 0.002,
  KWD: 0.003,
};

/** Rates are carried at eight significant figures — enough for JPY and KWD to differ honestly. */
export function roundRate(value: number): number {
  return Number(value.toPrecision(8));
}
