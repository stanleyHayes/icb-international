import { roundMinorUnits } from '@icb/money';

import { daysBetween } from '../../savings/domain/date-maths.js';
import {
  DAYS_IN_MONTH_30_360,
  DAYS_IN_YEAR_ACT_360,
  DAYS_IN_YEAR_ACT_365,
  MAX_DAY_30_360,
  type DayCountConvention,
} from '../accruals.constants.js';

/**
 * Day-count conventions.
 *
 * A year fraction turns an annual nominal rate into the interest a period earns; the only
 * difference between the conventions is what "a year" and "a month" mean. Stating each once,
 * here, keeps the accrual engine, the overdraft charge, and any projection from disagreeing
 * about what a day is worth.
 *
 * Pure functions: calendar arithmetic comes from the savings date-maths module (imported, not
 * duplicated); the caller supplies the dates. Everything is integer minor units in and out.
 */

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function partsOf(iso: string): DateParts {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
  };
}

/**
 * US 30/360: every month counts thirty days, every year three hundred and sixty.
 * A day of 31 is pulled back to the 30th; the end day follows only when the start day
 * was itself pulled back (or is February's last), so 30 January → 31 January is one day,
 * not zero.
 */
function thirty360Days(fromIso: string, toIso: string): number {
  const from = partsOf(fromIso);
  const to = partsOf(toIso);
  const fromDay = Math.min(from.day, MAX_DAY_30_360);
  const toDay =
    to.day === MAX_DAY_30_360 + 1 && fromDay === MAX_DAY_30_360 ? MAX_DAY_30_360 : to.day;

  return (
    DAYS_IN_YEAR_ACT_360 * (to.year - from.year) +
    DAYS_IN_MONTH_30_360 * (to.month - from.month) +
    (toDay - fromDay)
  );
}

/** The fraction of a year between two ISO calendar dates under `convention`. */
export function yearFraction(
  convention: DayCountConvention,
  fromIso: string,
  toIso: string,
): number {
  switch (convention) {
    case 'ACT/365':
      return daysBetween(fromIso, toIso) / DAYS_IN_YEAR_ACT_365;
    case 'ACT/360':
      return daysBetween(fromIso, toIso) / DAYS_IN_YEAR_ACT_360;
    case '30/360':
      return thirty360Days(fromIso, toIso) / DAYS_IN_YEAR_ACT_360;
  }
}

/**
 * Interest on `balanceMinorUnits` at an annual nominal `rate` (a fraction, e.g. `0.0525`)
 * for the period between two dates, rounded once to a whole minor unit.
 */
export function interestForPeriod(
  balanceMinorUnits: number,
  rate: number,
  convention: DayCountConvention,
  fromIso: string,
  toIso: string,
): number {
  if (balanceMinorUnits <= 0 || rate <= 0) {
    return 0;
  }
  const fraction = yearFraction(convention, fromIso, toIso);
  if (fraction <= 0) {
    return 0;
  }
  return roundMinorUnits(balanceMinorUnits * rate * fraction, 'half-even');
}
