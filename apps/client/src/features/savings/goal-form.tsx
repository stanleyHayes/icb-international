'use client';

import type { AccountSummary } from '@icb/contracts';
import { Button, maskIdentifier } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useState } from 'react';

import { FormError, MoneyField, SelectField, TextField, ToggleRow } from '../form-controls';
import { createGoalAction, type SavingsActionState } from './actions';
import type { Route } from 'next';

const IDLE: SavingsActionState = { status: 'idle', message: null, fieldErrors: {}, id: null };

const ICONS = [
  { value: 'target', label: 'Something else' },
  { value: 'home', label: 'A home' },
  { value: 'car', label: 'A car' },
  { value: 'plane', label: 'Travel' },
  { value: 'gift', label: 'A gift' },
  { value: 'umbrella', label: 'A rainy day' },
] as const;

const FREQUENCIES = [
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Every month' },
] as const;

/**
 * Open a savings goal: a name, a target, optionally a date, and the two helpers that do the
 * saving for you — round-ups on card spend and a standing contribution.
 */
export function GoalForm({ accounts }: Readonly<{ accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(createGoalAction, IDLE);
  const [roundUps, setRoundUps] = useState(false);
  const [auto, setAuto] = useState(false);
  const dateId = useId();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success' && state.id) {
      router.push(`/savings/goals/${state.id}` as Route);
    }
  }, [state.status, state.id, router]);

  const currency = accounts[0]?.currency ?? 'USD';
  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
  }));

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="roundUpsEnabled" value={roundUps ? 'on' : 'off'} />
      <FormError message={state.status === 'error' ? state.message : null} />

      <TextField
        label="What are you saving for?"
        name="name"
        maxLength={80}
        required
        placeholder="e.g. House deposit, December flights"
        error={state.fieldErrors['name']}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Kind of goal" name="icon" options={[...ICONS]} />
        <SelectField
          label="Save into"
          name="accountId"
          options={accountOptions}
          error={state.fieldErrors['accountId']}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          label="Target"
          name="target"
          currency={currency}
          error={state.fieldErrors['target']}
        />
        <div>
          <label htmlFor={dateId} className="block text-sm font-medium">
            Target date <span className="font-normal text-[var(--icb-text-subtle)]">(optional)</span>
          </label>
          <input
            id={dateId}
            name="targetDate"
            type="date"
            className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
          />
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--icb-border)] px-4 py-2">
        <ToggleRow
          label="Round-ups"
          description="Round each card purchase up to the nearest whole unit and save the difference."
          checked={roundUps}
          disabled={pending}
          onChange={setRoundUps}
        />
        <ToggleRow
          label="Automatic contribution"
          description="Move a fixed amount into this goal on a schedule."
          checked={auto}
          disabled={pending}
          onChange={setAuto}
        />
      </div>

      {auto ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <MoneyField
            label="Amount"
            name="autoAmount"
            currency={currency}
            error={state.fieldErrors['autoAmount']}
          />
          <SelectField label="How often" name="autoFrequency" options={[...FREQUENCIES]} />
          <SelectField label="From" name="autoFromAccountId" options={accountOptions} />
        </div>
      ) : null}

      <Button type="submit" size="lg" block loading={pending}>
        Create goal
      </Button>
    </form>
  );
}
