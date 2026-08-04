'use client';

import { Button } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { FormError } from '../form-controls';
import { breakDepositAction, type SavingsActionState } from './actions';

const IDLE: SavingsActionState = { status: 'idle', message: null, fieldErrors: {}, id: null };

/**
 * Confirm an early break. The penalty above this button is the quote the API will honour — the
 * break executes the quoted price, it does not re-price.
 */
export function BreakDepositButton({ depositId }: Readonly<{ depositId: string }>) {
  const [state, action, pending] = useActionState(breakDepositAction, IDLE);

  if (state.status === 'success') {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 text-sm text-[var(--icb-success-fg)]"
      >
        <CheckCircle2 size={16} />
        Deposit broken. The proceeds are back in your account.
      </p>
    );
  }

  return (
    <form action={action} noValidate>
      <input type="hidden" name="depositId" value={depositId} />
      <FormError message={state.status === 'error' ? state.message : null} />
      <Button type="submit" variant="danger" loading={pending}>
        Break this deposit
      </Button>
      <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
        This is immediate and cannot be undone.
      </p>
    </form>
  );
}
