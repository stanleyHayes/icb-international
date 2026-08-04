'use client';

import { Button, Dialog } from '@icb/ui';
import { Plus } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { issueCardAction, type CardActionState } from './actions';
import { FormDone, FormError } from './form-feedback';

const INITIAL: CardActionState = { status: 'idle', message: null, fieldErrors: {} };

const KIND_OPTIONS = [
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
  { value: 'virtual', label: 'Virtual' },
] as const;

const NETWORK_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
] as const;

/**
 * Issue a card to an account.
 *
 * Lives behind a dialog so the list page stays a list page; the account id is typed explicitly
 * rather than defaulted, because issuing to the wrong account is a plastic-in-the-post mistake.
 */
export function IssueCardDialog({ defaultAccountId }: Readonly<{ defaultAccountId?: string }>) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(issueCardAction, INITIAL);
  const accountIdId = useId();
  const kindId = useId();
  const networkId = useId();
  const nicknameId = useId();

  return (
    <>
      <Button type="button" leadingIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
        Issue card
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Issue a card"
        description="The card is created against the account and recorded in the audit trail under your staff account."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Card issued.'} />
        ) : (
          <form action={action} className="space-y-4">
            <FormError message={state.message} />

            <Field label="Account ID" htmlFor={accountIdId} error={state.fieldErrors['accountId']}>
              <input
                id={accountIdId}
                name="accountId"
                required
                defaultValue={defaultAccountId ?? ''}
                aria-invalid={state.fieldErrors['accountId'] ? true : undefined}
                className={INPUT_CLASS}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind" htmlFor={kindId}>
                <select id={kindId} name="kind" className={INPUT_CLASS}>
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Network" htmlFor={networkId}>
                <select id={networkId} name="network" className={INPUT_CLASS}>
                  {NETWORK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Nickname" htmlFor={nicknameId} error={state.fieldErrors['nickname']}>
              <input
                id={nicknameId}
                name="nickname"
                maxLength={60}
                placeholder="Optional"
                className={INPUT_CLASS}
              />
            </Field>

            <Button type="submit" block loading={pending}>
              {pending ? 'Issuing…' : 'Issue card'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

const INPUT_CLASS =
  'mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]';

function Field({
  label,
  htmlFor,
  error,
  children,
}: Readonly<{ label: string; htmlFor: string; error?: string | undefined; children: React.ReactNode }>) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p> : null}
    </div>
  );
}
