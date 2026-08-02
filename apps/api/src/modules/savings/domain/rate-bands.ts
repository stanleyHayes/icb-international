import type { DepositRateBand } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

/**
 * The term × amount rate card.
 *
 * A term deposit is priced on two axes — how long the bank keeps the money and how much of it
 * there is — so the rate card is a matrix, not a list. Declaring it as data rather than as a
 * chain of conditionals means the published `/savings/rates` card and the rate actually booked
 * on a deposit come from the same source and cannot drift apart.
 *
 * Minimums are declared in *major* units and converted per currency, so the card is meaningful
 * for a zero-decimal currency without a second table.
 */

interface BandDefinition {
  /** Minimum term this band applies from, in whole months. */
  readonly termMonths: number;
  readonly minimumMajorUnits: number;
  /** Annual nominal rate as a fraction. */
  readonly rate: number;
}

const BANDS: readonly BandDefinition[] = [
  { termMonths: 1, minimumMajorUnits: 500, rate: 0.025 },
  { termMonths: 1, minimumMajorUnits: 5_000, rate: 0.0275 },
  { termMonths: 1, minimumMajorUnits: 50_000, rate: 0.03 },
  { termMonths: 3, minimumMajorUnits: 500, rate: 0.0325 },
  { termMonths: 3, minimumMajorUnits: 5_000, rate: 0.035 },
  { termMonths: 3, minimumMajorUnits: 50_000, rate: 0.0375 },
  { termMonths: 6, minimumMajorUnits: 500, rate: 0.04 },
  { termMonths: 6, minimumMajorUnits: 5_000, rate: 0.0425 },
  { termMonths: 6, minimumMajorUnits: 50_000, rate: 0.045 },
  { termMonths: 12, minimumMajorUnits: 500, rate: 0.0475 },
  { termMonths: 12, minimumMajorUnits: 5_000, rate: 0.051 },
  { termMonths: 12, minimumMajorUnits: 50_000, rate: 0.054 },
  { termMonths: 24, minimumMajorUnits: 500, rate: 0.0525 },
  { termMonths: 24, minimumMajorUnits: 5_000, rate: 0.056 },
  { termMonths: 24, minimumMajorUnits: 50_000, rate: 0.059 },
  { termMonths: 36, minimumMajorUnits: 500, rate: 0.056 },
  { termMonths: 36, minimumMajorUnits: 5_000, rate: 0.0595 },
  { termMonths: 36, minimumMajorUnits: 50_000, rate: 0.0625 },
  { termMonths: 60, minimumMajorUnits: 500, rate: 0.06 },
  { termMonths: 60, minimumMajorUnits: 5_000, rate: 0.0635 },
  { termMonths: 60, minimumMajorUnits: 50_000, rate: 0.0665 },
];

/** Smallest amount that can open any term deposit, in major units. */
export const MINIMUM_DEPOSIT_MAJOR_UNITS = 500;

/** Shortest term the bank offers, in whole months. */
export const MINIMUM_TERM_MONTHS = 1;

function toMinorUnits(majorUnits: number, currency: CurrencyCode): number {
  return majorUnits * 10 ** getScale(currency);
}

function toBand(definition: BandDefinition, currency: CurrencyCode): DepositRateBand {
  return {
    termMonths: definition.termMonths,
    minimumAmount: {
      minorUnits: toMinorUnits(definition.minimumMajorUnits, currency),
      currency,
      scale: getScale(currency),
    },
    rate: definition.rate,
  };
}

/** The published rate card, ordered by term then by amount. */
export function listRateBands(currency: CurrencyCode): DepositRateBand[] {
  return BANDS.map((definition) => toBand(definition, currency));
}

/** The minimum opening amount in minor units for a currency. */
export function minimumDepositMinorUnits(currency: CurrencyCode): number {
  return toMinorUnits(MINIMUM_DEPOSIT_MAJOR_UNITS, currency);
}

/**
 * The band a request qualifies for: the longest term and largest amount tier it reaches.
 *
 * A 9-month request is priced off the 6-month band rather than rejected — the bank is happy to
 * hold the money for longer at the shorter term's rate — while an amount below the smallest
 * tier qualifies for nothing and returns null so the caller can refuse it explicitly.
 */
export function resolveRateBand(
  termMonths: number,
  principalMinorUnits: number,
  currency: CurrencyCode,
): DepositRateBand | null {
  const eligible = BANDS.filter(
    (band) =>
      band.termMonths <= termMonths &&
      toMinorUnits(band.minimumMajorUnits, currency) <= principalMinorUnits,
  );

  if (eligible.length === 0) {
    return null;
  }

  const best = eligible.reduce((winner, candidate) =>
    candidate.rate > winner.rate ? candidate : winner,
  );
  return toBand(best, currency);
}
