import { Amount, formatDate } from '@icb/ui';

import type { CashflowProjection, RecurringCharge } from './derive';

/**
 * Recurring charges detected in the transaction feed. Detection is deliberately conservative
 * (same counterparty, stable amount, repeating across months) and says so, because a list that
 * cries wolf trains the customer to ignore it.
 */
export function RecurringCharges({
  charges,
  currency,
}: Readonly<{ charges: readonly RecurringCharge[]; currency: string }>) {
  const monthlyTotal = charges.reduce((sum, charge) => sum + charge.amountMinorUnits, 0);

  return (
    <>
      <ul className="divide-y divide-[var(--icb-border)]">
        {charges.map((charge) => (
          <li key={charge.name} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{charge.name}</p>
              <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                {charge.occurrences} charges · last {formatDate(charge.lastChargedAt, 'medium')}
              </p>
            </div>
            <Amount
              value={{ minorUnits: charge.amountMinorUnits, currency: charge.currency }}
              size="sm"
            />
          </li>
        ))}
      </ul>
      {charges.length > 0 ? (
        <p className="border-t border-[var(--icb-border)] px-5 py-3 text-xs text-[var(--icb-text-subtle)]">
          About <Amount value={{ minorUnits: monthlyTotal, currency }} size="sm" /> leaves your
          account each month across these. Review anything you no longer use.
        </p>
      ) : null}
    </>
  );
}

/**
 * Where the balance is heading: the average month's net, repeated three months out. It is an
 * average, not a forecast — the copy says exactly that, because a bank that pretends to know
 * the future is one that will be wrong in both directions.
 */
export function ProjectionSummary({
  projection,
  currency,
}: Readonly<{ projection: CashflowProjection; currency: string }>) {
  const positive = projection.averageNetMinorUnits >= 0;

  return (
    <div className="px-5 py-5">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            Average month
          </p>
          <p className="mt-2">
            <Amount
              value={{ minorUnits: projection.averageNetMinorUnits, currency }}
              direction={positive ? 'credit' : 'debit'}
              size="xl"
            />
          </p>
          <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">
            {positive ? 'more in than out' : 'more out than in'}, on average
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            Position in {projection.monthsProjected} months
          </p>
          <p className="mt-2">
            <Amount
              value={{ minorUnits: projection.projectedMinorUnits, currency }}
              size="xl"
            />
          </p>
          <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">
            if the average month repeats — an average, not a forecast
          </p>
        </div>
      </div>
    </div>
  );
}
