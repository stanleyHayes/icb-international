'use client';

import { Button } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { FormError, TextField } from '../form-controls';
import {
  setPinAction,
  setTravelNoticeAction,
  type CardSecurityState,
} from './security-actions';

const INITIAL: CardSecurityState = { error: null, saved: false, reissuedCardId: null };

/** Set or change the four-digit PIN. The PIN is never displayed back. */
export function PinForm({ cardId, pinSet }: Readonly<{ cardId: string; pinSet: boolean }>) {
  const [state, action, pending] = useActionState(setPinAction, INITIAL);
  const confirmId = useId();

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="cardId" value={cardId} />
      <FormError message={state.error} />

      <TextField
        label={pinSet ? 'New PIN' : 'Choose a PIN'}
        name="pin"
        type="password"
        inputMode="numeric"
        maxLength={4}
        autoComplete="off"
        placeholder="4 digits"
      />
      <div>
        <label htmlFor={confirmId} className="block text-sm font-medium">
          Confirm PIN
        </label>
        <input
          id={confirmId}
          name="confirm"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          required
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pinSet ? 'Change PIN' : 'Set PIN'}
        </Button>
        {state.saved && !pending ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--icb-success-fg)]" role="status">
            <CheckCircle2 size={14} />
            PIN updated
          </p>
        ) : null}
      </div>
    </form>
  );
}

const COUNTRIES = [
  { value: 'GH', label: 'Ghana' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'KE', label: 'Kenya' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'IN', label: 'India' },
] as const;

/**
 * A travel notice tells authorisation to expect spending from these countries between the two
 * dates, instead of treating it as an anomaly.
 */
export function TravelNoticeForm({ cardId }: Readonly<{ cardId: string }>) {
  const [state, action, pending] = useActionState(setTravelNoticeAction, INITIAL);
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const fromId = useId();
  const toId = useId();

  const toggle = (code: string) => {
    setSelected((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="cardId" value={cardId} />
      <FormError message={state.error} />

      <fieldset>
        <legend className="text-sm font-medium">Travelling to</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {COUNTRIES.map((country) => {
            const active = selected.includes(country.value);
            return (
              <span key={country.value}>
                <input
                  type="checkbox"
                  name="countries"
                  value={country.value}
                  checked={active}
                  onChange={() => toggle(country.value)}
                  className="sr-only"
                />
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(country.value)}
                  className={
                    active
                      ? 'rounded-full border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] px-3 py-1.5 text-xs font-medium text-[var(--icb-primary)]'
                      : 'rounded-full border border-[var(--icb-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)]'
                  }
                >
                  {country.label}
                </button>
              </span>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={fromId} className="block text-sm font-medium">
            From
          </label>
          <input
            id={fromId}
            name="from"
            type="date"
            required
            className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
          />
        </div>
        <div>
          <label htmlFor={toId} className="block text-sm font-medium">
            Until
          </label>
          <input
            id={toId}
            name="to"
            type="date"
            required
            className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Save travel notice
        </Button>
        {state.saved && !pending ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--icb-success-fg)]" role="status">
            <CheckCircle2 size={14} />
            Notice saved
          </p>
        ) : null}
      </div>
    </form>
  );
}
