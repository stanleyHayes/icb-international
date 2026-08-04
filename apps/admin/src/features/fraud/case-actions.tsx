'use client';

import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId, useState, useTransition } from 'react';

import {
  claimCaseAction,
  resolveCaseAction,
  type FraudActionState,
} from './actions';

const INITIAL: FraudActionState = { status: 'idle', message: null, fieldErrors: {} };

const RESOLUTIONS = [
  { value: 'released', label: 'Release', hint: 'Genuine — let the payment through' },
  { value: 'blocked', label: 'Block & notify', hint: 'Fraud — stop it and tell the customer' },
  { value: 'customer_contacted', label: 'Customer contacted', hint: 'Verified out of band' },
  { value: 'escalated_to_aml', label: 'Escalate to AML', hint: 'Looks like laundering, not theft' },
  { value: 'no_action', label: 'No action', hint: 'Noted, nothing further' },
] as const;

interface CaseActionsProps {
  caseId: string;
  assignedTo: string | null;
}

/**
 * Claim and resolve a fraud case.
 *
 * The resolution is chosen explicitly — there is no default button to lean on, because the
 * default on a fraud queue gets clicked without being read.
 */
export function CaseActions({ caseId, assignedTo }: Readonly<CaseActionsProps>) {
  const [state, action, pending] = useActionState(resolveCaseAction, INITIAL);
  const [claimState, setClaimState] = useState<FraudActionState>(INITIAL);
  const [claiming, startClaim] = useTransition();
  const [resolution, setResolution] = useState('');
  const noteId = useId();

  if (assignedTo === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--icb-text-muted)]">
          This case is unclaimed. Claim it to take ownership before resolving.
        </p>
        {claimState.message ? (
          <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
            {claimState.message}
          </p>
        ) : null}
        <Button
          type="button"
          block
          loading={claiming}
          onClick={() =>
            startClaim(async () => setClaimState(await claimCaseAction(caseId)))
          }
        >
          Claim case
        </Button>
      </div>
    );
  }

  if (state.status === 'done') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Resolution recorded and attributed to you.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="action" value={resolution} />

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
        <legend className="text-sm font-medium">Resolution</legend>
        <div className="mt-2 grid gap-2">
          {RESOLUTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setResolution(option.value)}
              aria-pressed={resolution === option.value}
              className={
                resolution === option.value
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
        <label htmlFor={noteId} className="block text-sm font-medium">
          Case note
        </label>
        <textarea
          id={noteId}
          name="note"
          rows={4}
          required
          minLength={4}
          placeholder="What did you verify, and why this resolution?"
          aria-invalid={state.fieldErrors['note'] ? true : undefined}
          className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {state.fieldErrors['note'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{state.fieldErrors['note']}</p>
        ) : (
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Written to the audit trail against your account.
          </p>
        )}
      </div>

      <Button type="submit" block loading={pending} disabled={!resolution}>
        {pending ? 'Recording…' : 'Record resolution'}
      </Button>
    </form>
  );
}
