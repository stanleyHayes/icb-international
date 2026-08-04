'use client';

import { Button } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState } from 'react';

import { FormError, TextField } from '../form-controls';
import { reportCardAction, type CardSecurityState } from './security-actions';
import type { Route } from 'next';

const INITIAL: CardSecurityState = { error: null, saved: false, reissuedCardId: null };

const REASONS = [
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'not_received', label: 'Never arrived' },
  { value: 'fraud', label: 'Fraudulent activity' },
] as const;

/**
 * Report and replace. The reported card is dead the moment the API confirms; the replacement
 * keeps the controls and limits but needs a new PIN.
 */
export function ReportCardForm({ cardId }: Readonly<{ cardId: string }>) {
  const [state, action, pending] = useActionState(reportCardAction, INITIAL);
  const router = useRouter();

  if (state.saved) {
    return (
      <div role="status">
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          {state.reissuedCardId
            ? 'The card is blocked and a replacement is on its way. Set a new PIN when it arrives.'
            : 'The card is blocked. No further payments can be made with it.'}
        </p>
        {state.reissuedCardId ? (
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => router.push(`/cards/${state.reissuedCardId}` as Route)}
          >
            View replacement card
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="cardId" value={cardId} />
      <FormError message={state.error} />

      <fieldset>
        <legend className="text-sm font-medium">What happened?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REASONS.map((reason, index) => (
            <label
              key={reason.value}
              className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3 py-2.5 text-sm has-checked:border-[var(--icb-primary)] has-checked:bg-[var(--icb-navy-50)]"
            >
              <input
                type="radio"
                name="reason"
                value={reason.value}
                defaultChecked={index === 0}
                className="accent-[var(--icb-primary)]"
              />
              {reason.label}
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        label="Anything we should know"
        name="detail"
        hint="(optional)"
        maxLength={500}
        placeholder="e.g. Last used at a fuel station on Monday"
      />

      <fieldset>
        <legend className="text-sm font-medium">Send a replacement?</legend>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="reissue"
              value="yes"
              defaultChecked
              className="accent-[var(--icb-primary)]"
            />
            Yes, reissue
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="reissue" value="no" className="accent-[var(--icb-primary)]" />
            No, just block it
          </label>
        </div>
      </fieldset>

      <Button type="submit" variant="danger" loading={pending}>
        Block this card
      </Button>
      <p className="text-xs text-[var(--icb-text-subtle)]">
        This takes effect immediately and cannot be undone.
      </p>
    </form>
  );
}
