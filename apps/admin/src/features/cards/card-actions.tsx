'use client';

import { Button, Dialog, Select } from '@icb/ui';
import { Ban, KeyRound, RefreshCw } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import {
  blockCardAction,
  pinResetAction,
  reissueCardAction,
  type CardActionState,
} from './actions';
import { FormDone, FormError } from './form-feedback';

const INITIAL: CardActionState = { status: 'idle', message: null, fieldErrors: {} };

const REISSUE_REASONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
  { value: 'not_received', label: 'Never received' },
  { value: 'fraud', label: 'Fraud' },
] as const;

const TEXTAREA_CLASS =
  'mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]';

interface ActionProps {
  readonly cardId: string;
  /** A cancelled or un-reissuable card hides the operations that no longer make sense. */
  readonly blocked: boolean;
  readonly terminal: boolean;
}

/** The destructive operations on one card, each behind a confirmation and an audit reason. */
export function CardActions({ cardId, blocked, terminal }: ActionProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {!terminal && !blocked ? <BlockButton cardId={cardId} /> : null}
      {!terminal ? <ReissueButton cardId={cardId} /> : null}
      {!terminal && !blocked ? <PinResetButton cardId={cardId} /> : null}
    </div>
  );
}

function useDialog() {
  const [open, setOpen] = useState(false);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

function BlockButton({ cardId }: Readonly<{ cardId: string }>) {
  const dialog = useDialog();
  const [state, action, pending] = useActionState(blockCardAction, INITIAL);
  const reasonId = useId();

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        leadingIcon={<Ban size={15} />}
        onClick={dialog.show}
      >
        Block card
      </Button>
      <Dialog
        open={dialog.open}
        onClose={dialog.hide}
        title="Block this card?"
        description="A staff block cannot be lifted by the customer. Every authorisation is declined until the block is removed."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Card blocked.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="cardId" value={cardId} />
            <FormError message={state.message} />
            <ReasonField
              id={reasonId}
              name="reason"
              error={state.fieldErrors['reason']}
              placeholder="Why is this card being blocked?"
            />
            <Button type="submit" variant="danger" block loading={pending}>
              {pending ? 'Blocking…' : 'Confirm block'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function ReissueButton({ cardId }: Readonly<{ cardId: string }>) {
  const dialog = useDialog();
  const [state, action, pending] = useActionState(reissueCardAction, INITIAL);
  const reasonId = useId();
  const detailId = useId();

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leadingIcon={<RefreshCw size={15} />}
        onClick={dialog.show}
      >
        Reissue
      </Button>
      <Dialog
        open={dialog.open}
        onClose={dialog.hide}
        title="Reissue this card?"
        description="The current PAN is retired immediately and a replacement is ordered, linked to this card."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Replacement ordered.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="cardId" value={cardId} />
            <FormError message={state.message} />
            <div>
              <label htmlFor={reasonId} className="block text-sm font-medium">
                Reason
              </label>
              <Select id={reasonId} name="reason" className="mt-1.5">
                {REISSUE_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <ReasonField
              id={detailId}
              name="detail"
              label="Detail"
              error={state.fieldErrors['detail']}
              placeholder="What happened to the current card?"
            />
            <Button type="submit" block loading={pending}>
              {pending ? 'Ordering…' : 'Order replacement'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function PinResetButton({ cardId }: Readonly<{ cardId: string }>) {
  const dialog = useDialog();
  const [state, action, pending] = useActionState(pinResetAction, INITIAL);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leadingIcon={<KeyRound size={15} />}
        onClick={dialog.show}
      >
        Reset PIN
      </Button>
      <Dialog
        open={dialog.open}
        onClose={dialog.hide}
        title="Reset the PIN?"
        description="The current PIN is invalidated. Staff never see or choose a PIN — the customer sets the new one through their own verified flow."
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'PIN reset started.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="cardId" value={cardId} />
            <FormError message={state.message} />
            <Button type="submit" block loading={pending}>
              {pending ? 'Resetting…' : 'Confirm PIN reset'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function ReasonField({
  id,
  name,
  label = 'Reason',
  error,
  placeholder,
}: Readonly<{
  id: string;
  name: string;
  label?: string;
  error?: string | undefined;
  placeholder: string;
}>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        required
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={TEXTAREA_CLASS}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
          Written to the audit trail against your account.
        </p>
      )}
    </div>
  );
}
