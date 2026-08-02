import { fromMinorUnits, isCurrencyCode, type CurrencyCode, type Money } from '@icb/money';

/**
 * What every end-of-day step is told.
 *
 * The business date is passed rather than read from the clock inside each step, so that re-running
 * a past date behaves identically to running today — the whole pipeline is a pure function of this
 * context plus the state of the books.
 */
export interface EodContext {
  /** ISO date being closed, e.g. `2026-08-02`. */
  readonly businessDate: string;
  /** The instant the run is treating as "now". Postings are booked here. */
  readonly asOf: Date;
}

/**
 * The bank's reporting currency, used for the report's aggregate totals.
 *
 * The report carries a single money figure for interest and for fees, so multi-currency totals are
 * summed in the reporting currency. Configuration is narrowed here rather than trusted: an
 * unrecognised code would otherwise produce a Money object no formatter can render.
 */
export function reportingCurrency(configured: string): CurrencyCode {
  return isCurrencyCode(configured) ? configured : 'USD';
}

/**
 * A running total across the books.
 *
 * A bank posts in every currency it holds, but the end-of-day report carries one figure for
 * interest and one for fees. Totals are therefore kept per currency here and folded into the
 * reporting currency only at the edge — at face value, without an FX rate, because the batch does
 * not hold rates and inventing one would put a number in the report that no ledger supports.
 * `breakdown()` is what an operator should read when more than one currency is live.
 */
export class CurrencyTotals {
  private readonly totals = new Map<CurrencyCode, number>();

  add(amount: Money): void {
    this.totals.set(amount.currency, (this.totals.get(amount.currency) ?? 0) + amount.minorUnits);
  }

  breakdown(): { currency: CurrencyCode; minorUnits: number }[] {
    return [...this.totals].map(([currency, minorUnits]) => ({ currency, minorUnits }));
  }

  /** The single figure the report carries. */
  toMoney(reporting: CurrencyCode): Money {
    let total = 0;
    for (const minorUnits of this.totals.values()) {
      total += minorUnits;
    }
    return fromMinorUnits(total, reporting);
  }
}

/** `YYYY-MM` for the month containing an ISO date. */
export function periodOf(businessDate: string): string {
  return businessDate.slice(0, 7);
}

/** True when the date is the first calendar day of its month. */
export function isFirstOfMonth(businessDate: string): boolean {
  return businessDate.endsWith('-01');
}
