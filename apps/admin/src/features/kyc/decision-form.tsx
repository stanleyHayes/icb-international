'use client';

import type { KycLevel } from '@icb/contracts';
import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { decideAction, type DecisionState } from './actions';

const INITIAL: DecisionState = { status: 'idle', message: null, fieldErrors: {} };

const OUTCOMES = [
  { value: 'approved', label: 'Approve', tone: 'primary' },
  { value: 'more_info_required', label: 'Request more', tone: 'secondary' },
  { value: 'declined', label: 'Reject', tone: 'danger' },
] as const;

const LEVELS: readonly KycLevel[] = ['tier_1', 'tier_2', 'tier_3'];

/**
 * The decision.
 *
 * The outcome is chosen explicitly rather than defaulted, because a form that arrives
 * pre-set to "approve" is a form that gets approved by accident.
 */
export function DecisionForm({
  caseId,
  requestedLevel,
}: Readonly<{ caseId: string; requestedLevel: KycLevel }>) {
  const [state, action, pending] = useActionState(decideAction, INITIAL);
  const [outcome, setOutcome] = useState<string>('');
  const reasonId = useId();
  const levelId = useId();

  if (state.status === 'decided') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Decision recorded and attributed to you.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="outcome" value={outcome} />

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
        <legend className="text-sm font-medium">Outcome</legend>
        <div className="mt-2 grid gap-2">
          {OUTCOMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setOutcome(option.value)}
              aria-pressed={outcome === option.value}
              className={
                outcome === option.value
                  ? 'h-10 rounded-[var(--radius-md)] border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] text-sm font-medium text-[var(--icb-primary)]'
                  : 'h-10 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] text-sm font-medium text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)]'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {outcome === 'approved' ? (
        <div>
          <label htmlFor={levelId} className="block text-sm font-medium">
            Tier to grant
          </label>
          <select
            id={levelId}
            name="grantedLevel"
            defaultValue={requestedLevel}
            className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.replace('_', ' ')}
                {level === requestedLevel ? ' (requested)' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor={reasonId} className="block text-sm font-medium">
          Reason
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={4}
          required
          placeholder="What did you see that led to this decision?"
          aria-invalid={state.fieldErrors['reason'] ? true : undefined}
          className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {state.fieldErrors['reason'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{state.fieldErrors['reason']}</p>
        ) : (
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Written to the audit trail against your account.
          </p>
        )}
      </div>

      <Button type="submit" block loading={pending} disabled={!outcome}>
        {pending ? 'Recording…' : 'Record decision'}
      </Button>
    </form>
  );
}
