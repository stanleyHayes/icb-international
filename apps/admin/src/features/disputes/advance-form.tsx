'use client';

import { DISPUTE_OUTCOMES, DISPUTE_STAGES } from '@icb/contracts';
import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { advanceDisputeAction, type DisputeActionState } from './actions';

const INITIAL: DisputeActionState = { status: 'idle', message: null, fieldErrors: {} };

const selectClass =
  'h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm capitalize outline-none focus:border-[var(--icb-primary)]';

/**
 * Move a dispute forward.
 *
 * The stage is chosen explicitly, the outcome is only offered when resolving, and provisional
 * credit is an opt-in checkbox on the credit stage — an advance should never grant money the
 * analyst did not consciously ask for.
 */
export function AdvanceForm({
  disputeId,
  currentStage,
  hasProvisionalCredit,
}: Readonly<{
  disputeId: string;
  currentStage: string;
  hasProvisionalCredit: boolean;
}>) {
  const [state, action, pending] = useActionState(advanceDisputeAction, INITIAL);
  const [stage, setStage] = useState('');
  const stageId = useId();
  const noteId = useId();

  const targets = DISPUTE_STAGES.filter(
    (candidate) => candidate !== currentStage && candidate !== 'submitted',
  );

  if (state.status === 'done') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Dispute advanced and recorded.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="disputeId" value={disputeId} />

      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor={stageId} className="block text-sm font-medium">
          Advance to stage
        </label>
        <select
          id={stageId}
          name="stage"
          required
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className={`mt-1.5 ${selectClass}`}
        >
          <option value="" disabled>
            Select a stage…
          </option>
          {targets.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {stage === 'resolved' ? <OutcomeSelect /> : null}
      {stage === 'provisional_credit' && !hasProvisionalCredit ? <CreditOption /> : null}
      <NoteField id={noteId} error={state.fieldErrors['note']} />

      <Button type="submit" block loading={pending} disabled={!stage}>
        {pending ? 'Advancing…' : 'Advance dispute'}
      </Button>
    </form>
  );
}

function OutcomeSelect() {
  const outcomeId = useId();
  return (
    <div>
      <label htmlFor={outcomeId} className="block text-sm font-medium">
        Outcome
      </label>
      <select id={outcomeId} name="outcome" required defaultValue="" className={`mt-1.5 ${selectClass}`}>
        <option value="" disabled>
          Select an outcome…
        </option>
        {DISPUTE_OUTCOMES.map((outcome) => (
          <option key={outcome} value={outcome}>
            {outcome}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreditOption() {
  const creditId = useId();
  return (
    <label
      htmlFor={creditId}
      className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 py-3 text-sm"
    >
      <input
        id={creditId}
        type="checkbox"
        name="grantProvisionalCredit"
        className="mt-0.5 h-4 w-4 accent-[var(--icb-primary)]"
      />
      <span>
        <span className="block font-medium">Grant provisional credit</span>
        <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
          Credits the disputed amount to the customer while the case is investigated.
        </span>
      </span>
    </label>
  );
}

function NoteField({ id, error }: Readonly<{ id: string; error: string | undefined }>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        Note
      </label>
      <textarea
        id={id}
        name="note"
        rows={4}
        required
        minLength={4}
        placeholder="What did you check, and why this move?"
        aria-invalid={error ? true : undefined}
        className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
      />
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
          Written to the dispute timeline against your account.
        </p>
      )}
    </div>
  );
}
