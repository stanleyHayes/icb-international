'use client';

import { Button, Input } from '@icb/ui';
import { Check, Pencil, X } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';

import { updateNickname, type AccountActionState } from './actions';

const INITIAL: AccountActionState = { error: null, done: false };

/**
 * Rename an account in place.
 *
 * The pencil swaps the heading for a single-line form; saving goes through the update endpoint
 * and the server revalidates the accounts cache, so the new name shows everywhere at once.
 */
export function NicknameEditor({
  accountId,
  currentNickname,
  fallbackName,
}: Readonly<{ accountId: string; currentNickname: string | null; fallbackName: string }>) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateNickname, INITIAL);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.done) setEditing(false);
    }
  }, [state]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Rename ${currentNickname ?? fallbackName}`}
        className="rounded-[var(--radius-sm)] p-1.5 text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
      >
        <Pencil size={16} />
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 max-w-sm space-y-2">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex items-center gap-2">
        <Input
          name="nickname"
          size="sm"
          maxLength={60}
          defaultValue={currentNickname ?? ''}
          placeholder={fallbackName}
          aria-label="Account nickname"
          invalid={state.error !== null}
          autoFocus
        />
        <Button type="submit" size="sm" loading={pending} aria-label="Save nickname">
          <Check size={15} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setEditing(false)}
          aria-label="Cancel renaming"
        >
          <X size={15} />
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-[var(--icb-danger-fg)]">
          {state.error}
        </p>
      ) : (
        <p className="text-xs text-[var(--icb-text-subtle)]">Leave empty to use the product name.</p>
      )}
    </form>
  );
}
