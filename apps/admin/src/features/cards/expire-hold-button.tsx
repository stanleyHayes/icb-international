'use client';

import { Button, Dialog } from '@icb/ui';
import { TimerOff } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { expireHoldAction, type CardActionState } from './actions';
import { FormDone, FormError } from './form-feedback';

const INITIAL: CardActionState = { status: 'idle', message: null, fieldErrors: {} };

interface ExpireHoldButtonProps {
  readonly cardId: string;
  readonly authorisationId: string;
  readonly merchantName: string;
}

/**
 * Force-expire an open authorisation hold.
 *
 * Expiring releases the reserved funds back to the available balance immediately, so it sits
 * behind a confirmation and a mandatory audit reason rather than a bare table-row click.
 */
export function ExpireHoldButton({ cardId, authorisationId, merchantName }: ExpireHoldButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(expireHoldAction, INITIAL);
  const reasonId = useId();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        leadingIcon={<TimerOff size={14} />}
        onClick={() => setOpen(true)}
      >
        Expire
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Expire this hold?"
        description={`The hold from ${merchantName} is released and the funds return to the available balance.`}
      >
        {state.status === 'done' ? (
          <FormDone message={state.message ?? 'Hold expired.'} />
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="cardId" value={cardId} />
            <input type="hidden" name="authorisationId" value={authorisationId} />
            <FormError message={state.message} />
            <div>
              <label htmlFor={reasonId} className="block text-sm font-medium">
                Reason
              </label>
              <textarea
                id={reasonId}
                name="reason"
                rows={3}
                required
                placeholder="Why is this hold being released early?"
                aria-invalid={state.fieldErrors['reason'] ? true : undefined}
                className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--icb-primary)]"
              />
              {state.fieldErrors['reason'] ? (
                <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
                  {state.fieldErrors['reason']}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
                  Written to the audit trail against your account.
                </p>
              )}
            </div>
            <Button type="submit" variant="danger" block loading={pending}>
              {pending ? 'Expiring…' : 'Confirm expire'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
