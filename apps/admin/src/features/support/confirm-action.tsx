'use client';

import { Button, Dialog } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

import { IDLE_STATE, type FormState } from './types';

type Action = (previous: FormState, formData: FormData) => Promise<FormState>;

interface ConfirmActionProps {
  readonly triggerLabel: string;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly action: Action;
  /** Hidden form values the action needs, e.g. `{ macroId: '…' }`. */
  readonly fields: Record<string, string>;
  readonly danger?: boolean;
  readonly triggerVariant?: 'secondary' | 'ghost' | 'danger';
}

/**
 * A confirmed mutation.
 *
 * Every destructive or hard-to-reverse action in the console routes through this dialog so the
 * click that fires it is always a second, deliberate click — never a mis-tap on a table row.
 */
export function ConfirmAction({
  triggerLabel,
  title,
  description,
  confirmLabel,
  action,
  fields,
  danger = false,
  triggerVariant = 'secondary',
}: Readonly<ConfirmActionProps>) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  useEffect(() => {
    if (state.status === 'done') setOpen(false);
  }, [state.status]);

  return (
    <>
      <Button type="button" variant={triggerVariant} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <form action={formAction}>
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={pending}>
                {confirmLabel}
              </Button>
            </form>
          </>
        }
      >
        {state.message ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {state.message}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
