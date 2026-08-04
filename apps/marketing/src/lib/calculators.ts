import { getMinorUnitFactor, type CurrencyCode } from '@icb/money';

/**
 * Calculator maths. Every computation runs in BigInt fixed point — a calculator that leaks
 * float error into a money figure would contradict the bank's own ledger rule (N3). Rates and
 * FX quotes arrive as decimal strings from text inputs and are parsed into rationals, so
 * "8.9" is exactly 89/10, never the nearest double.
 */

const SCALE = 10n ** 18n;
const MONTHS_PER_YEAR = 12n;
const PERCENT_DENOMINATOR = 100n;
const MAX_SAVINGS_MONTHS = 1200;

export interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/** Parse a non-negative decimal string ("8.9", "0.8562") into an exact rational. */
export function parseDecimalToRational(text: string): Rational | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const fraction = match[2] ?? '';
  const denominator = 10n ** BigInt(fraction.length);
  return { numerator: BigInt(match[1] ?? '0') * denominator + BigInt(fraction || '0'), denominator };
}

/** Half-up division for non-negative BigInts. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Monthly compounding factor minus one, in SCALE fixed point, from an annual percent rate. */
function monthlyRateFixed(rate: Rational): bigint {
  const denominator = rate.denominator * PERCENT_DENOMINATOR * MONTHS_PER_YEAR;
  return (SCALE * rate.numerator) / denominator;
}

/** (1 + f)^periods in SCALE fixed point, truncated at each step so the magnitude stays bounded. */
function powFixed(factor: bigint, periods: number): bigint {
  let result = SCALE;
  const base = SCALE + factor;
  for (let index = 0; index < periods; index += 1) {
    result = (result * base) / SCALE;
  }
  return result;
}

/**
 * The fixed monthly payment on an amortising loan, in integer minor units.
 * payment = P · r · (1+r)^n / ((1+r)^n − 1), rounded half-up. Returns null on invalid input.
 */
export function monthlyPaymentMinorUnits(
  principalMinor: number,
  annualRateText: string,
  termMonths: number,
): number | null {
  const rate = parseDecimalToRational(annualRateText);
  if (rate === null || principalMinor <= 0 || termMonths <= 0) {
    return null;
  }
  if (rate.numerator === 0n) {
    return Number(divRound(BigInt(principalMinor), BigInt(termMonths)));
  }
  const factor = monthlyRateFixed(rate);
  const raised = powFixed(factor, termMonths);
  const numerator = BigInt(principalMinor) * factor * raised;
  const denominator = SCALE * (raised - SCALE);
  return Number(divRound(numerator, denominator));
}

export interface SavingsGoalResult {
  readonly months: number;
  /** False when the goal is not reached within a hundred years — the plan needs changing. */
  readonly reached: boolean;
}

/**
 * Months until a savings balance reaches a goal, compounding monthly with a fixed monthly
 * contribution added after interest. The balance is held in fixed point and only the final
 * comparison happens against the integer goal, so no rounding decision is ever taken mid-run.
 */
export function monthsToSavingsGoal(options: {
  readonly goalMinor: number;
  readonly currentMinor: number;
  readonly monthlyMinor: number;
  readonly annualRateText: string;
}): SavingsGoalResult | null {
  const rate = parseDecimalToRational(options.annualRateText);
  if (rate === null || options.goalMinor <= 0 || options.monthlyMinor < 0) {
    return null;
  }
  if (options.currentMinor >= options.goalMinor) {
    return { months: 0, reached: true };
  }
  const factor = monthlyRateFixed(rate);
  const goal = BigInt(options.goalMinor) * SCALE;
  const contribution = BigInt(options.monthlyMinor) * SCALE;
  let balance = BigInt(options.currentMinor) * SCALE;

  for (let month = 1; month <= MAX_SAVINGS_MONTHS; month += 1) {
    balance += (balance * factor) / SCALE + contribution;
    if (balance >= goal) {
      return { months: month, reached: true };
    }
  }
  return { months: MAX_SAVINGS_MONTHS, reached: false };
}

/**
 * Convert between currencies at an editable rate expressed as target units per source unit
 * ("0.8562" turns 1 USD into 0.8562 EUR). Integer minor units in, integer minor units out.
 */
export function convertMinorUnits(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rateText: string,
): number | null {
  const rate = parseDecimalToRational(rateText);
  if (rate === null || rate.numerator <= 0n || amountMinor < 0) {
    return null;
  }
  const numerator =
    BigInt(amountMinor) * BigInt(getMinorUnitFactor(to)) * rate.numerator;
  const denominator = BigInt(getMinorUnitFactor(from)) * rate.denominator;
  return Number(divRound(numerator, denominator));
}
