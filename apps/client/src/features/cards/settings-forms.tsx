'use client';

import type { CardDetail } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Button, minorUnitsToDraft, type MoneyLike } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useActionState, useState } from 'react';

import { FormError, MoneyField, ToggleRow } from '../form-controls';
import {
  updateControlsAction,
  updateLimitsAction,
  type CardSettingsState,
} from './settings-actions';

const INITIAL: CardSettingsState = { error: null, saved: false };

const CHANNEL_LABELS: Readonly<Record<string, string>> = {
  online: 'Online and in-app',
  contactless: 'Contactless',
  atm: 'ATM withdrawals',
  international: 'Outside your country',
  in_store: 'In store (chip and PIN)',
};

const BLOCKABLE_CATEGORIES = [
  'groceries',
  'dining',
  'fuel',
  'travel',
  'shopping',
  'entertainment',
  'subscriptions',
  'transport',
] as const;

/**
 * Where the card works. Each switch posts the full channel map — an omitted channel is off — and
 * every one of them is enforced at authorisation, not merely recorded.
 */
export function ControlsForm({ card }: Readonly<{ card: CardDetail }>) {
  const [state, action, pending] = useActionState(updateControlsAction, INITIAL);
  const [channels, setChannels] = useState<Record<string, boolean>>({ ...card.controls.channels });
  const [blocked, setBlocked] = useState<ReadonlyArray<string>>(card.controls.blockedCategories);

  const toggleCategory = (category: string) => {
    setBlocked((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="cardId" value={card.id} />
      <FormError message={state.error} />

      <ul className="divide-y divide-[var(--icb-border)]">
        {Object.entries(CHANNEL_LABELS).map(([channel, label]) => (
          <li key={channel}>
            <input
              type="hidden"
              name={`channel.${channel}`}
              value={channels[channel] ? 'on' : 'off'}
            />
            <ToggleRow
              label={label}
              checked={channels[channel] ?? false}
              disabled={pending}
              onChange={(on) => setChannels((current) => ({ ...current, [channel]: on }))}
            />
          </li>
        ))}
      </ul>

      <fieldset>
        <legend className="text-sm font-medium">Blocked spending categories</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {BLOCKABLE_CATEGORIES.map((category) => {
            const active = blocked.includes(category);
            return (
              <span key={category}>
                <input
                  type="checkbox"
                  name="blockedCategories"
                  value={category}
                  checked={active}
                  onChange={() => toggleCategory(category)}
                  className="sr-only"
                />
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCategory(category)}
                  className={
                    active
                      ? 'rounded-full border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--icb-danger-fg)] capitalize'
                      : 'rounded-full border border-[var(--icb-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--icb-text-muted)] capitalize hover:bg-[var(--icb-bg-muted)]'
                  }
                >
                  {category}
                </button>
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
          Highlighted categories are declined at authorisation.
        </p>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Save controls
        </Button>
        <SavedNote saved={state.saved && !pending} />
      </div>
    </form>
  );
}

const LIMIT_LABELS: Readonly<Record<string, string>> = {
  perTransaction: 'Per transaction',
  daily: 'Daily',
  monthly: 'Monthly',
  atmDaily: 'ATM daily',
  contactless: 'Contactless',
};

/** Spend limits, edited as decimal drafts and parsed to minor units in the action. */
export function LimitsForm({ card }: Readonly<{ card: CardDetail }>) {
  const [state, action, pending] = useActionState(updateLimitsAction, INITIAL);
  const currency = card.limits.daily.currency;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="cardId" value={card.id} />
      <input type="hidden" name="currency" value={currency} />
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(LIMIT_LABELS).map(([field, label]) => (
          <MoneyField
            key={field}
            label={label}
            name={field}
            currency={currency}
            defaultValue={draftOf(card.limits[field as keyof typeof card.limits])}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Save limits
        </Button>
        <SavedNote saved={state.saved && !pending} />
      </div>
    </form>
  );
}

function draftOf(value: MoneyLike): string {
  return minorUnitsToDraft(value.minorUnits, value.currency as CurrencyCode);
}

function SavedNote({ saved }: Readonly<{ saved: boolean }>) {
  if (!saved) {
    return null;
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-[var(--icb-success-fg)]" role="status">
      <CheckCircle2 size={14} />
      Saved
    </p>
  );
}
