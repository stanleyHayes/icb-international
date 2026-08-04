'use client';

import type { CurrencyCode } from '@icb/money';
import { Button, MoneyInput } from '@icb/ui';
import { useActionState, useId, useState } from 'react';

import { FormDone, FormError } from '@/features/cards/form-feedback';

import { decideApplicationAction, type LoanActionState } from './actions';

const INITIAL: LoanActionState = { status: 'idle', message: null, fieldErrors: {} };

const OUTCOMES = [
  { value: 'approved', label: 'Approve' },
  { value: 'referred', label: 'Refer' },
  { value: 'declined', label: 'Decline' },
] as const;

interface DecisionFormProps {
  readonly applicationId: string;
  readonly currency: CurrencyCode;
  readonly requestedAmountMinorUnits: number;
  readonly scorecardRate: number | null;
}

/**
 * The underwriting decision.
 *
 * No outcome is pre-selected, and every outcome demands a written justification: the scorecard
 * recommends, the underwriter decides, and the decision has to be explainable to the applicant
 * and to an auditor afterwards.
 */
export function DecisionForm({
  applicationId,
  currency,
  requestedAmountMinorUnits,
  scorecardRate,
}: DecisionFormProps) {
  const [state, action, pending] = useActionState(decideApplicationAction, INITIAL);
  const [outcome, setOutcome] = useState('');
  const [amount, setAmount] = useState<number | null>(requestedAmountMinorUnits);
  const justificationId = useId();

  if (state.status === 'done') {
    return <FormDone message={state.message ?? 'Decision recorded.'} />;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="outcome" value={outcome} />
      <FormError message={state.message} />

      <OutcomePicker outcome={outcome} onChange={setOutcome} />

      {outcome === 'approved' ? (
        <ApprovalFields
          currency={currency}
          amount={amount}
          onAmountChange={setAmount}
          scorecardRate={scorecardRate}
          errors={state.fieldErrors}
        />
      ) : null}

      <div>
        <label htmlFor={justificationId} className="block text-sm font-medium">
          Justification
        </label>
        <textarea
          id={justificationId}
          name="justification"
          rows={4}
          required
          placeholder="Why is this the right decision? Shown to the applicant."
          aria-invalid={state.fieldErrors['justification'] ? true : undefined}
          className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {state.fieldErrors['justification'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {state.fieldErrors['justification']}
          </p>
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

/** The outcome is chosen explicitly — a form pre-set to "approve" gets approved by accident. */
function OutcomePicker({
  outcome,
  onChange,
}: Readonly<{ outcome: string; onChange: (value: string) => void }>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Outcome</legend>
      <div className="mt-2 grid gap-2">
        {OUTCOMES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
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
  );
}

/** Amount and rate overrides, only relevant when the decision is an approval. */
function ApprovalFields({
  currency,
  amount,
  onAmountChange,
  scorecardRate,
  errors,
}: Readonly<{
  currency: CurrencyCode;
  amount: number | null;
  onAmountChange: (value: number | null) => void;
  scorecardRate: number | null;
  errors: Record<string, string>;
}>) {
  const amountId = useId();
  const rateId = useId();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={amountId} className="block text-sm font-medium">
          Approved amount
        </label>
        <div className="mt-1.5">
          <MoneyInput
            id={amountId}
            currency={currency}
            value={amount}
            invalid={errors['approvedAmount'] !== undefined}
            onChange={onAmountChange}
          />
        </div>
        <input type="hidden" name="approvedAmount" value={amount === null ? '' : String(amount)} />
        {errors['approvedAmount'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{errors['approvedAmount']}</p>
        ) : null}
      </div>
      <div>
        <label htmlFor={rateId} className="block text-sm font-medium">
          Rate override %
        </label>
        <input
          id={rateId}
          name="approvedRate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder={scorecardRate === null ? 'Scorecard rate' : String(scorecardRate)}
          aria-invalid={errors['approvedRate'] ? true : undefined}
          className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        {errors['approvedRate'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{errors['approvedRate']}</p>
        ) : null}
      </div>
    </div>
  );
}
