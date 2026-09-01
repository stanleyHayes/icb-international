'use client';

import { Button, RadioGroup } from '@icb/ui';
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
        <RadioGroup
          name="reason"
          defaultValue={REASONS[0].value}
          orientation="horizontal"
          options={REASONS}
          className="mt-2"
        />
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
        <RadioGroup
          name="reissue"
          defaultValue="yes"
          orientation="horizontal"
          className="mt-2"
          options={[
            { value: 'yes', label: 'Yes, reissue' },
            { value: 'no', label: 'No, just block it' },
          ]}
        />
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
