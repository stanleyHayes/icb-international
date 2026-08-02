'use client';

import { Button } from '@icb/ui';
import { AlertCircle, Snowflake, Sun } from 'lucide-react';
import { useActionState } from 'react';

import { toggleFreezeAction, type CardActionState } from './actions';

const INITIAL: CardActionState = { error: null, frozen: null };

/**
 * Freeze and unfreeze.
 *
 * The displayed state comes from the server's answer, never from an optimistic guess: a freeze
 * that failed but appeared to work is the single worst outcome this control can produce.
 */
export function FreezeToggle({
  cardId,
  frozen,
}: Readonly<{ cardId: string; frozen: boolean }>) {
  const [state, action, pending] = useActionState(toggleFreezeAction, INITIAL);
  const isFrozen = state.frozen ?? frozen;

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="cardId" value={cardId} />
        <input type="hidden" name="freeze" value={String(!isFrozen)} />
        <Button
          type="submit"
          variant={isFrozen ? 'primary' : 'secondary'}
          loading={pending}
          leadingIcon={isFrozen ? <Sun size={16} /> : <Snowflake size={16} />}
        >
          {isFrozen ? 'Unfreeze card' : 'Freeze card'}
        </Button>
      </form>

      {state.error ? (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-xs text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
          {isFrozen
            ? 'No payment will authorise while frozen. Reversible at any time.'
            : 'Takes effect immediately, on every channel.'}
        </p>
      )}
    </div>
  );
}
