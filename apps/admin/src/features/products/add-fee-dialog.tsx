'use client';

import type { Fee, MoneyDto } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';
import { Button, Dialog, Field, Input, Select } from '@icb/ui';
import { useState } from 'react';

import { MoneyField } from './money-field';

/**
 * The add-fee dialog.
 *
 * Builds one fee into the working schedule; nothing is published until the operator commits
 * the whole schedule from the editor.
 */
export function AddFeeDialog({
  open,
  currency,
  onClose,
  onAdd,
}: Readonly<{
  open: boolean;
  currency: CurrencyCode;
  onClose: () => void;
  onAdd: (fee: Fee) => void;
}>) {
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = buildFee(new FormData(event.currentTarget), currency);
    if ('error' in draft) {
      setError(draft.error);
      return;
    }
    setError(null);
    onAdd(draft.fee);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a fee"
      description={`Amounts are in ${currency}, the product's first currency.`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-fee-form">
            Add to schedule
          </Button>
        </>
      }
    >
      <form id="add-fee-form" onSubmit={submit} className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required>
            <Input name="code" placeholder="atm-out-of-network" required />
          </Field>
          <Field label="Label" required>
            <Input name="label" placeholder="Out-of-network ATM" required />
          </Field>
        </div>
        <Field label="Basis" required>
          <Select name="basis" defaultValue="flat">
            <option value="flat">Flat amount</option>
            <option value="percentage">Percentage</option>
            <option value="tiered">Tiered</option>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField name="amount" label="Flat amount" currency={currency} />
          <Field label="Percentage">
            <Input name="percentage" type="number" step="0.01" min={0} max={100} />
          </Field>
          <MoneyField name="minimum" label="Minimum charge" currency={currency} />
          <MoneyField name="maximum" label="Maximum charge" currency={currency} />
        </div>
        <Field label="Waived for tiers" description="Comma-separated, e.g. tier_3, premium.">
          <Input name="waivedForTiers" />
        </Field>
      </form>
    </Dialog>
  );
}

type FeeDraft = { fee: Fee } | { error: string };

function textField(data: FormData, name: string): string {
  const raw = data.get(name);
  return typeof raw === 'string' ? raw.trim() : '';
}

function moneyField(data: FormData, name: string, currency: CurrencyCode): MoneyDto | null {
  const raw = data.get(name);
  if (typeof raw !== 'string' || raw === '') return null;
  return { minorUnits: Number(raw), currency, scale: getScale(currency) };
}

/** Build a fee from the dialog's form data, or return a validation message. */
function buildFee(data: FormData, currency: CurrencyCode): FeeDraft {
  const code = textField(data, 'code');
  const label = textField(data, 'label');
  const basis = (textField(data, 'basis') || 'flat') as Fee['basis'];
  if (!code || !label) return { error: 'A fee needs both a code and a label.' };

  const amount = moneyField(data, 'amount', currency);
  const percentageRaw = textField(data, 'percentage');
  const percentage = percentageRaw === '' ? null : Number(percentageRaw);
  if (basis === 'flat' && !amount) return { error: 'A flat fee needs an amount.' };
  if (basis === 'percentage' && percentage === null) {
    return { error: 'A percentage fee needs a rate.' };
  }

  const waivedForTiers = textField(data, 'waivedForTiers')
    .split(',')
    .map((tier) => tier.trim())
    .filter(Boolean);

  return {
    fee: {
      code,
      label,
      basis,
      amount,
      percentage,
      minimum: moneyField(data, 'minimum', currency),
      maximum: moneyField(data, 'maximum', currency),
      waivedForTiers,
    },
  };
}
