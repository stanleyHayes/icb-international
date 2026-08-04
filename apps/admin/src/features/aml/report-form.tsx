'use client';

import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { fileReportAction, type AmlActionState } from './actions';

const INITIAL: AmlActionState = { status: 'idle', message: null, fieldErrors: {} };

/**
 * Draft and file a SAR or CTR.
 *
 * The narrative starts from the case narrative — the analyst has already written the story once;
 * the filing should refine it, not demand it again.
 */
export function ReportForm({
  alertId,
  draftNarrative,
}: Readonly<{ alertId: string; draftNarrative: string | null }>) {
  const [state, action, pending] = useActionState(fileReportAction, INITIAL);
  const [kind, setKind] = useState<'sar' | 'ctr'>('sar');
  const narrativeId = useId();

  if (state.status === 'done') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Report filed and reference issued.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="alertId" value={alertId} />
      <input type="hidden" name="kind" value={kind} />

      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium">Report type</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              { value: 'sar', label: 'SAR', hint: 'Suspicious activity' },
              { value: 'ctr', label: 'CTR', hint: 'Currency transaction' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={kind === option.value}
              className={
                kind === option.value
                  ? 'rounded-[var(--radius-md)] border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] px-3.5 py-2.5 text-left'
                  : 'rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 py-2.5 text-left hover:bg-[var(--icb-bg-muted)]'
              }
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={narrativeId} className="block text-sm font-medium">
          Filing narrative
        </label>
        <textarea
          id={narrativeId}
          name="narrative"
          rows={9}
          required
          minLength={50}
          defaultValue={draftNarrative ?? ''}
          placeholder="The complete account of the suspicious activity, in plain language (min. 50 characters)."
          aria-invalid={state.fieldErrors['narrative'] ? true : undefined}
          className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {state.fieldErrors['narrative'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {state.fieldErrors['narrative']}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Filed against your officer account; the filing is idempotent.
          </p>
        )}
      </div>

      <Button type="submit" block loading={pending}>
        {pending ? 'Filing…' : `File ${kind.toUpperCase()}`}
      </Button>
    </form>
  );
}
