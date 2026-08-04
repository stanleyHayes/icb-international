'use client';

import { Button, Dialog, Field, Textarea } from '@icb/ui';
import { useActionState, useEffect, useState } from 'react';

import { completeCallbackAction } from './callback-actions';
import { ConfirmAction } from './confirm-action';
import { cancelCallbackAction } from './callback-actions';
import { IDLE_STATE, type CallbackView } from './types';

/**
 * What an agent can do with a pending callback: ring the customer and record the outcome, or
 * cancel — confirmed, because cancelling discards a request the customer made.
 */
export function CallbackActions({ callback }: Readonly<{ callback: CallbackView }>) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(completeCallbackAction, IDLE_STATE);

  useEffect(() => {
    if (state.status === 'done') setOpen(false);
  }, [state.status]);

  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Complete
      </Button>
      <ConfirmAction
        triggerLabel="Cancel"
        triggerVariant="ghost"
        title={`Cancel callback ${callback.reference}?`}
        description={`${callback.customerName} asked to be called about “${callback.reason}”. Cancelling closes that request without contact.`}
        confirmLabel="Cancel callback"
        danger
        action={cancelCallbackAction}
        fields={{ callbackId: callback.id }}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Complete ${callback.reference}`}
        description={`Call ${callback.customerName} on ${callback.phone}, then record how it went.`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button type="submit" form={`complete-${callback.id}`} loading={pending}>
              Mark completed
            </Button>
          </>
        }
      >
        <form id={`complete-${callback.id}`} action={action} className="space-y-4">
          <input type="hidden" name="callbackId" value={callback.id} />
          {state.message ? (
            <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
              {state.message}
            </p>
          ) : null}
          <Field label="Outcome notes" error={state.fieldErrors['notes']}>
            <Textarea
              name="notes"
              rows={4}
              maxLength={1000}
              placeholder="What was agreed on the call?"
            />
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
