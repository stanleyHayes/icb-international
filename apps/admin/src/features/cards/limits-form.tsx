'use client';

import type { CardLimits } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Button, MoneyInput } from '@icb/ui';
import { useActionState, useId, useState } from 'react';

import { updateLimitsAction, type CardActionState } from './actions';
import { FormDone, FormError } from './form-feedback';

const INITIAL: CardActionState = { status: 'idle', message: null, fieldErrors: {} };

const LIMIT_FIELDS = [
  { name: 'perTransaction', label: 'Per transaction' },
  { name: 'daily', label: 'Daily spend' },
  { name: 'monthly', label: 'Monthly spend' },
  { name: 'atmDaily', label: 'ATM daily' },
  { name: 'contactless', label: 'Contactless' },
] as const;

type LimitName = (typeof LIMIT_FIELDS)[number]['name'];

interface LimitsFormProps {
  readonly cardId: string;
  readonly currency: CurrencyCode;
  readonly limits: CardLimits;
}

/**
 * Limit editing.
 *
 * Values are integer minor units end to end: MoneyInput produces them, hidden inputs carry them,
 * and the server action re-validates against the contract schema before the API sees anything.
 */
export function LimitsForm({ cardId, currency, limits }: LimitsFormProps) {
  const [state, action, pending] = useActionState(updateLimitsAction, INITIAL);
  const [values, setValues] = useState<Record<LimitName, number | null>>({
    perTransaction: limits.perTransaction.minorUnits,
    daily: limits.daily.minorUnits,
    monthly: limits.monthly.minorUnits,
    atmDaily: limits.atmDaily.minorUnits,
    contactless: limits.contactless.minorUnits,
  });
  const baseId = useId();

  if (state.status === 'done') {
    return <FormDone message={state.message ?? 'Limits updated.'} />;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="currency" value={currency} />
      <FormError message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        {LIMIT_FIELDS.map((field) => (
          <div key={field.name}>
            <label
              htmlFor={`${baseId}-${field.name}`}
              className="block text-sm font-medium text-[var(--icb-text-muted)]"
            >
              {field.label}
            </label>
            <div className="mt-1.5">
              <MoneyInput
                id={`${baseId}-${field.name}`}
                currency={currency}
                value={values[field.name]}
                invalid={state.fieldErrors[field.name] !== undefined}
                onChange={(minorUnits) =>
                  setValues((current) => ({ ...current, [field.name]: minorUnits }))
                }
              />
            </div>
            <input
              type="hidden"
              name={field.name}
              value={values[field.name] === null ? '' : String(values[field.name])}
            />
            {state.fieldErrors[field.name] ? (
              <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
                {state.fieldErrors[field.name]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--icb-text-subtle)]">
        Limit changes take effect on the next authorisation and are written to the audit trail
        against your account.
      </p>

      <Button type="submit" loading={pending}>
        {pending ? 'Saving…' : 'Save limits'}
      </Button>
    </form>
  );
}
