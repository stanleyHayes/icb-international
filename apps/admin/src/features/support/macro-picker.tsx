'use client';

import { Button, Dialog, Field, Select } from '@icb/ui';
import { useActionState, useEffect, useState } from 'react';

import { applyMacroAction } from './ticket-actions';
import { IDLE_STATE, type MacroView } from './types';

/**
 * Apply a macro.
 *
 * The operator previews the rendered body before it goes anywhere near the customer: a macro
 * posts as the agent's own reply, attributed to them, so "apply" is a reviewed decision rather
 * than a fire-and-forget shortcut.
 */
export function MacroPicker({
  ticketId,
  macros,
}: Readonly<{ ticketId: string; macros: MacroView[] }>) {
  const [state, action, pending] = useActionState(applyMacroAction, IDLE_STATE);
  const [macroId, setMacroId] = useState('');
  const [confirming, setConfirming] = useState(false);

  const selected = macros.find((macro) => macro.id === macroId);

  useEffect(() => {
    if (state.status === 'done') setConfirming(false);
  }, [state.status]);

  if (macros.length === 0) {
    return <p className="text-sm text-[var(--icb-text-subtle)]">No macros have been written yet.</p>;
  }

  return (
    <div className="space-y-3">
      <Field label="Macro">
        <Select value={macroId} onChange={(event) => setMacroId(event.target.value)}>
          <option value="">Choose a macro…</option>
          {macros.map((macro) => (
            <option key={macro.id} value={macro.id}>
              {macro.name} · {macro.category}
            </option>
          ))}
        </Select>
      </Field>

      <Button
        type="button"
        variant="secondary"
        disabled={!selected}
        onClick={() => setConfirming(true)}
      >
        Preview and apply
      </Button>

      <Dialog
        open={confirming && selected !== undefined}
        onClose={() => setConfirming(false)}
        title={selected?.name ?? 'Apply macro'}
        description="Posted as your reply on this ticket, exactly as rendered below."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <form action={action}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <input type="hidden" name="macroId" value={macroId} />
              <Button type="submit" loading={pending}>
                Send as reply
              </Button>
            </form>
          </>
        }
      >
        <p className="rounded-[var(--radius-md)] bg-[var(--icb-bg-subtle)] px-4 py-3 text-sm whitespace-pre-wrap">
          {selected?.body}
        </p>
        {state.message ? (
          <p role="alert" className="mt-3 text-sm text-[var(--icb-danger-fg)]">
            {state.message}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
