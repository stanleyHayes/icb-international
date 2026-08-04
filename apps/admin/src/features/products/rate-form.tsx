'use client';

import { Button, Field, Input, formatDate, formatTime } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useActionState } from 'react';

import { scheduleRateAction } from './catalogue-actions';
import { IDLE_RATE } from './types';

/**
 * Schedule a rate change.
 *
 * Rates are effective-dated, never edited in place: a change is announced with the moment it
 * takes effect, and accrual answers "the rate on that day" from the schedule. After saving,
 * the API's returned schedule is shown back so the operator sees what is now on the books.
 */
export function RateForm({
  productCode,
  currentRate,
}: Readonly<{ productCode: string; currentRate: number | null }>) {
  const [state, action, pending] = useActionState(scheduleRateAction, IDLE_RATE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--icb-text-muted)]">
        Current rate:{' '}
        <span className="tabular font-semibold text-[var(--icb-text)]">
          {currentRate === null ? 'None' : `${currentRate}%`}
        </span>
      </p>

      <form action={action} className="space-y-4">
        <input type="hidden" name="productCode" value={productCode} />

        {state.message ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {state.message}
          </p>
        ) : null}

        <Field
          label="Effective from"
          error={state.fieldErrors['effectiveFrom']}
          description="May be in the future; the rate applies from this moment."
          required
        >
          <Input name="effectiveFrom" type="datetime-local" required />
        </Field>
        <Field label="New rate (% per year)" error={state.fieldErrors['rate']} required>
          <Input name="rate" type="number" step="0.01" min={0} max={100} required />
        </Field>

        <Button type="submit" loading={pending}>
          {pending ? 'Scheduling…' : 'Schedule change'}
        </Button>
      </form>

      {state.schedule ? (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--icb-border)]">
          <table className="w-full text-sm">
            <caption className="sr-only">Rate schedule now in force</caption>
            <thead>
              <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="px-4 py-2 font-medium">
                  Effective from
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {state.schedule.map((change) => (
                <tr key={change.effectiveFrom}>
                  <td className="px-4 py-2 text-xs">
                    {formatDate(change.effectiveFrom, 'medium')} {formatTime(change.effectiveFrom)}
                  </td>
                  <td className="tabular px-4 py-2 text-right text-xs font-medium">
                    {change.rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
