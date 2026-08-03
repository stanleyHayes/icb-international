import { addMonths } from '../../savings/domain/date-maths.js';
import {
  QUARTER_END_MONTHS,
  type CapitalisationSchedule,
} from '../accruals.constants.js';

/**
 * Capitalisation scheduling.
 *
 * Interest accrues daily but only becomes the customer's — posted to their account, and part
 * of the balance the next day's accrual compounds on — on the capitalisation date. Monthly
 * and quarterly capitalisation follow the account's own statement day, so the interest lands
 * with the statement that reports it; `at_maturity` never capitalises here at all, because a
 * term deposit's interest is posted by the deposits lifecycle at maturity, not by this engine.
 *
 * Pure functions over ISO calendar dates; the caller supplies "today" from the clock.
 */

/** Days in the calendar month containing `businessDate` (`YYYY-MM-DD`). */
export function daysInMonthOf(businessDate: string): number {
  const year = Number(businessDate.slice(0, 4));
  const month = Number(businessDate.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The statement date in the month containing `businessDate`, clamped for short months.
 * An account opened on the 31st still has a statement date in February: the 28th (or 29th).
 */
export function statementDateIn(businessDate: string, statementDay: number): string {
  const day = Math.min(statementDay, daysInMonthOf(businessDate));
  return `${businessDate.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/** True when `businessDate` is the account's statement date this month. */
export function isStatementDate(businessDate: string, statementDay: number): boolean {
  return statementDateIn(businessDate, statementDay) === businessDate;
}

/**
 * The statement cycle `(previous, current]` that a statement-dated charge covers. Open at the
 * previous statement date — activity on that day was billed last cycle — closed at the current.
 */
export function statementCycle(
  businessDate: string,
  statementDay: number,
): { fromExclusive: string; toInclusive: string } {
  const current = statementDateIn(businessDate, statementDay);
  return { fromExclusive: addMonths(current, -1), toInclusive: current };
}

/** True when accrued interest should be posted on `businessDate` under `schedule`. */
export function isCapitalisationDate(
  businessDate: string,
  schedule: CapitalisationSchedule,
  statementDay: number,
): boolean {
  switch (schedule) {
    case 'monthly':
      return isStatementDate(businessDate, statementDay);
    case 'quarterly':
      return (
        QUARTER_END_MONTHS.includes(Number(businessDate.slice(5, 7))) &&
        isStatementDate(businessDate, statementDay)
      );
    case 'at_maturity':
      return false;
  }
}
