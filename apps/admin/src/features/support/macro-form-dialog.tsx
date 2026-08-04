'use client';

import { Button, Dialog, Field, Input, Textarea } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useActionState, useEffect } from 'react';

import { saveMacroAction } from './macro-actions';
import { IDLE_STATE, type FormState, type MacroView } from './types';

/** Create or edit a macro. Remounted per macro via `key`, so fields always start clean. */
export function MacroFormDialog({
  open,
  editing,
  onClose,
}: Readonly<{ open: boolean; editing: MacroView | null; onClose: () => void }>) {
  const [state, action, pending] = useActionState(saveMacroAction, IDLE_STATE);

  useEffect(() => {
    if (state.status === 'done') onClose();
  }, [state.status, onClose]);

  const title = editing ? `Edit “${editing.name}”` : 'New macro';
  const submitLabel = editing ? 'Save changes' : 'Create macro';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="The body is posted as the agent's reply when the macro is applied."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="macro-form" loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <MacroForm action={action} state={state} editing={editing} />
    </Dialog>
  );
}

function MacroForm({
  action,
  state,
  editing,
}: Readonly<{
  action: (payload: FormData) => void;
  state: FormState;
  editing: MacroView | null;
}>) {
  return (
    <form id="macro-form" action={action} className="space-y-4">
      {editing ? <input type="hidden" name="macroId" value={editing.id} /> : null}
      {state.message ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}
      <Field label="Name" error={state.fieldErrors['name']} required>
        <Input name="name" defaultValue={editing?.name ?? ''} required maxLength={80} />
      </Field>
      <Field label="Category" error={state.fieldErrors['category']}>
        <Input name="category" defaultValue={editing?.category ?? 'general'} maxLength={40} />
      </Field>
      <Field label="Body" error={state.fieldErrors['body']} required>
        <Textarea name="body" rows={6} defaultValue={editing?.body ?? ''} required />
      </Field>
    </form>
  );
}
