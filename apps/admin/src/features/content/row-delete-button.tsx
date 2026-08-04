'use client';

import { Button } from '@icb/ui';
import { useActionState } from 'react';

import { IDLE_STATE, type FormState } from './types';

type RowAction = (previous: FormState, formData: FormData) => Promise<FormState>;

/**
 * A delete button for a table row: a small form with a hidden id input, posting the row's
 * delete action. Failures surface inline rather than in a dialog.
 */
export function RowDeleteButton({
  action,
  field,
  id,
}: Readonly<{ action: RowAction; field: string; id: string }>) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name={field} value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        loading={pending}
        className="text-[var(--icb-danger-fg)]"
      >
        Delete
      </Button>
      {state.message ? (
        <span role="alert" className="text-xs text-[var(--icb-danger-fg)]">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
