import { ValidationError } from '../../../common/errors/index.js';

/** One row of the statement's transaction table, seen from the account's point of view. */
export interface StatementLine {
  valueDate: string;
  description: string;
  direction: 'debit' | 'credit';
  minorUnits: number;
  /** Balance after this line, so a reader can follow the arithmetic down the page. */
  balanceMinorUnits: number;
}

export interface StatementPeriod {
  from: string;
  to: string;
  /** `YYYY-MM`, taken from the start of the window. The contract requires this shape. */
  period: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const ISO_DATE_LENGTH = 10;
const MONTH_KEY_LENGTH = 7;

/**
 * Validates the requested window against the business date.
 *
 * A statement for a period that has not finished would be reissued with different numbers
 * tomorrow, so the end date is capped at today rather than quietly returning a partial month
 * that a customer might file as final.
 */
export function resolvePeriod(from: string, to: string, today: string): StatementPeriod {
  if (from > to) {
    throw new ValidationError('The statement period must start before it ends', [
      { path: 'from', message: 'Must be on or before the end date' },
    ]);
  }
  if (to > today) {
    throw new ValidationError('A statement cannot cover a period that has not happened yet', [
      { path: 'to', message: `Must be on or before ${today}` },
    ]);
  }
  return { from, to, period: from.slice(0, MONTH_KEY_LENGTH) };
}

/**
 * The calendar month containing `date`, as a whole-month window. A monthly statement is
 * simply this window run through `resolvePeriod`; there is no second code path for it.
 */
export function monthPeriod(date: string): StatementPeriod {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return {
    from: from.toISOString().slice(0, ISO_DATE_LENGTH),
    to: to.toISOString().slice(0, ISO_DATE_LENGTH),
    period: date.slice(0, MONTH_KEY_LENGTH),
  };
}

/** `2026-01-31` → `31 Jan 2026`. Unambiguous to both a US and a European reader. */
export function formatIsoDate(iso: string): string {
  const monthIndex = Number(iso.slice(5, 7)) - 1;
  return `${iso.slice(8, 10)} ${MONTH_NAMES[monthIndex] ?? '???'} ${iso.slice(0, 4)}`;
}

export function formatPeriodLabel(period: StatementPeriod): string {
  return `${formatIsoDate(period.from)} to ${formatIsoDate(period.to)}`;
}

/** Running balances for the table, walked forward from the opening figure. */
export function withRunningBalances(
  lines: readonly Omit<StatementLine, 'balanceMinorUnits'>[],
  openingMinorUnits: number,
): StatementLine[] {
  let balance = openingMinorUnits;
  return lines.map((line) => {
    balance += line.direction === 'credit' ? line.minorUnits : -line.minorUnits;
    return { ...line, balanceMinorUnits: balance };
  });
}
