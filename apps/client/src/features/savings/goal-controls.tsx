'use client';

import type { AccountSummary, SavingsGoal } from '@icb/contracts';
import { Button, maskIdentifier } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';

import { FormError, MoneyField, SelectField, ToggleRow } from '../form-controls';
import { contributeAction, updateGoalAction, type SavingsActionState } from './actions';

const IDLE: SavingsActionState = { status: 'idle', message: null, fieldErrors: {}, id: null };

/** Put money into the goal from any active account. */
export function ContributeForm({
  goal,
  accounts,
}: Readonly<{ goal: SavingsGoal; accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(contributeAction, IDLE);
  const currency = goal.target.currency;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="goalId" value={goal.id} />
      <input type="hidden" name="currency" value={currency} />
      <FormError message={state.status === 'error' ? state.message : null} />

      <SelectField
        label="From"
        name="fromAccountId"
        options={accounts.map((account) => ({
          value: account.id,
          label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
        }))}
        error={state.fieldErrors['fromAccountId']}
      />
      <MoneyField
        label="Amount"
        name="amount"
        currency={currency}
        error={state.fieldErrors['amount']}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Add to goal
        </Button>
        {state.status === 'success' && !pending ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--icb-success-fg)]" role="status">
            <CheckCircle2 size={14} />
            Added
          </p>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Round-ups and the goal lifecycle. Each control posts on its own and the result shown is the
 * one the API confirmed.
 */
export function GoalControls({ goal }: Readonly<{ goal: SavingsGoal }>) {
  const [roundUps, setRoundUps] = useState(goal.roundUpsEnabled);
  const [roundupState, roundupAction, roundupPending] = useActionState(updateGoalAction, IDLE);
  const [lifecycleState, lifecycleAction, lifecyclePending] = useActionState(updateGoalAction, IDLE);
  const roundupForm = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (lifecycleState.message === 'deleted') {
      router.push('/savings');
    }
  }, [lifecycleState.message, router]);

  const paused = goal.status === 'paused';

  return (
    <div className="space-y-4">
      <form action={roundupAction} ref={roundupForm} noValidate>
        <input type="hidden" name="goalId" value={goal.id} />
        <input type="hidden" name="intent" value="roundups" />
        <input type="hidden" name="roundUpsEnabled" value={roundUps ? 'on' : 'off'} />
        <ToggleRow
          label="Round-ups"
          description="Save the spare change from each card purchase into this goal."
          checked={roundUps}
          disabled={roundupPending}
          onChange={(on) => {
            setRoundUps(on);
            // The hidden field reads state on the next render, so submit after it lands.
            setTimeout(() => roundupForm.current?.requestSubmit(), 0);
          }}
        />
      </form>

      <FormError message={roundupState.status === 'error' ? roundupState.message : null} />
      <FormError message={lifecycleState.status === 'error' ? lifecycleState.message : null} />

      <div className="flex flex-wrap gap-3 border-t border-[var(--icb-border)] pt-4">
        <form action={lifecycleAction} noValidate>
          <input type="hidden" name="goalId" value={goal.id} />
          <input type="hidden" name="intent" value={paused ? 'resume' : 'pause'} />
          <Button type="submit" variant="secondary" size="sm" loading={lifecyclePending}>
            {paused ? 'Resume goal' : 'Pause goal'}
          </Button>
        </form>
        <form action={lifecycleAction} noValidate>
          <input type="hidden" name="goalId" value={goal.id} />
          <input type="hidden" name="intent" value="cancel" />
          <Button type="submit" variant="danger" size="sm" loading={lifecyclePending}>
            Cancel goal
          </Button>
        </form>
      </div>
      <p className="text-xs text-[var(--icb-text-subtle)]">
        Pausing stops automatic contributions and round-ups. Cancelling returns any saved money to
        the funding account.
      </p>
    </div>
  );
}
