import type { RepaymentFrequency } from '@icb/contracts';
import type { Money } from '@icb/money';

import { periodsPerYear } from './amortisation.js';

/**
 * Representative APR.
 *
 * The nominal rate is what the loan is priced at; the APR is what it actually costs, because it
 * includes the arrangement fee and compounds at the repayment frequency. Quoting only the nominal
 * rate is how a customer is surprised at signing, so both are shown side by side.
 *
 * Solved by bisection on the periodic internal rate of return: find `r` such that the instalments
 * discounted at `r` equal the net advance the customer actually receives. Bisection rather than
 * Newton–Raphson because the cash-flow profile is monotonic here and bisection cannot diverge —
 * a mispriced APR is worse than a slow one.
 */

const MAX_PERIODIC_RATE = 1;
const ITERATIONS = 100;
const PERCENT = 100;
const APR_DECIMALS = 2;

function presentValue(instalments: readonly Money[], rate: number): number {
  let total = 0;
  for (let index = 0; index < instalments.length; index += 1) {
    total += (instalments[index]?.minorUnits ?? 0) / (1 + rate) ** (index + 1);
  }
  return total;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface AprInput {
  /** What the customer receives: the principal less any fee deducted at drawdown. */
  readonly netAdvance: Money;
  readonly instalments: readonly Money[];
  readonly frequency: RepaymentFrequency;
}

/** The effective annual rate, as a percentage rounded to two decimal places. */
export function representativeApr(input: AprInput): number {
  const advance = input.netAdvance.minorUnits;
  if (advance <= 0 || input.instalments.length === 0) {
    return 0;
  }

  let low = 0;
  let high = MAX_PERIODIC_RATE;

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2;
    // Present value falls as the discount rate rises, so the root is bracketed throughout.
    if (presentValue(input.instalments, mid) > advance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const periodic = (low + high) / 2;
  const annual = ((1 + periodic) ** periodsPerYear(input.frequency) - 1) * PERCENT;
  return roundToDecimals(annual, APR_DECIMALS);
}
