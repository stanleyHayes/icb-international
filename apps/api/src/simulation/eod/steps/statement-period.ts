const MS_PER_DAY = 86_400_000;

/** The calendar month a statement covers, as inclusive ISO date bounds plus its `YYYY-MM` label. */
export interface StatementPeriod {
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

/**
 * The month that ended the day before `businessDate`.
 *
 * Derived by stepping back one day from the first of the current month rather than by decrementing
 * a month number, which is the arithmetic that gets January wrong.
 */
export function previousPeriod(businessDate: string): StatementPeriod {
  const firstOfThisMonth = new Date(`${businessDate.slice(0, 8)}01T00:00:00.000Z`);
  const lastOfPrevious = new Date(firstOfThisMonth.getTime() - MS_PER_DAY);
  const label = lastOfPrevious.toISOString().slice(0, 7);

  return {
    label,
    from: `${label}-01`,
    to: lastOfPrevious.toISOString().slice(0, 10),
  };
}
