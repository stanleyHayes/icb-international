'use client';

import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId } from 'react';

import { updateAlertAction, type AmlActionState } from './actions';

const INITIAL: AmlActionState = { status: 'idle', message: null, fieldErrors: {} };

const STATUS_STEPS = [
  { value: 'investigating', label: 'Investigate' },
  { value: 'escalated', label: 'Escalate' },
  { value: 'closed', label: 'Close' },
  { value: 'dismissed', label: 'Dismiss' },
] as const;

interface CaseWorkflowProps {
  alertId: string;
  currentStatus: string;
  assigned: boolean;
  narrative: string | null;
}

/**
 * The AML case workflow: claim, move status, and build the narrative.
 *
 * Status moves are separate small submissions rather than one big form — an escalation should
 * never be lost because a narrative field failed validation in the same request.
 */
export function CaseWorkflow({
  alertId,
  currentStatus,
  assigned,
  narrative,
}: Readonly<CaseWorkflowProps>) {
  const [state, action, pending] = useActionState(updateAlertAction, INITIAL);
  const narrativeId = useId();
  const terminal = currentStatus === 'closed' || currentStatus === 'dismissed';

  return (
    <div className="space-y-5">
      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === 'done' ? (
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Case updated and audited.
        </p>
      ) : null}

      {!assigned ? (
        <form action={action}>
          <input type="hidden" name="alertId" value={alertId} />
          <input type="hidden" name="intent" value="assign" />
          <Button type="submit" block loading={pending} variant="secondary">
            Assign to me
          </Button>
        </form>
      ) : null}

      {!terminal ? (
        <fieldset>
          <legend className="text-sm font-medium">Move case</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {STATUS_STEPS.map((step) => (
              <form key={step.value} action={action}>
                <input type="hidden" name="alertId" value={alertId} />
                <input type="hidden" name="intent" value="status" />
                <input type="hidden" name="status" value={step.value} />
                <Button
                  type="submit"
                  block
                  loading={pending}
                  variant={step.value === 'closed' ? 'primary' : 'secondary'}
                  disabled={currentStatus === step.value}
                >
                  {step.label}
                </Button>
              </form>
            ))}
          </div>
        </fieldset>
      ) : null}

      <form action={action}>
        <input type="hidden" name="alertId" value={alertId} />
        <input type="hidden" name="intent" value="narrative" />
        <label htmlFor={narrativeId} className="block text-sm font-medium">
          Case narrative
        </label>
        <textarea
          id={narrativeId}
          name="narrative"
          rows={7}
          defaultValue={narrative ?? ''}
          placeholder="Who, what, when, why it is suspicious — this drafts the report below."
          aria-invalid={state.fieldErrors['narrative'] ? true : undefined}
          className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {state.fieldErrors['narrative'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {state.fieldErrors['narrative']}
          </p>
        ) : null}
        <Button type="submit" loading={pending} className="mt-3">
          {pending ? 'Saving…' : 'Save narrative'}
        </Button>
      </form>
    </div>
  );
}
