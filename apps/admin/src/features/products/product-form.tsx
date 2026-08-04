'use client';

import { ACCOUNT_KINDS } from '@icb/contracts';
import { CURRENCY_CODES, type CurrencyCode } from '@icb/money';
import { Button, Checkbox, Field, Input, Select, Textarea } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useState } from 'react';

import { MoneyField } from './money-field';
import { createProductAction } from './product-actions';
import { IDLE } from './types';

const KIND_LABELS: Readonly<Record<string, string>> = {
  current: 'Current account',
  savings: 'Savings account',
  fixed_deposit: 'Fixed deposit',
  loan: 'Loan',
  card: 'Card',
};

/**
 * New product.
 *
 * The form maps one-to-one onto the catalogue schema: nothing is defaulted behind the
 * operator's back, and money fields are empty — meaning "no limit" — until a figure is set.
 * Fees start empty and are scheduled on the product page after creation.
 */
export function ProductForm() {
  const [state, action, pending] = useActionState(createProductAction, IDLE);
  const [currencies, setCurrencies] = useState<CurrencyCode[]>(['GHS']);
  const primary = currencies[0] ?? 'GHS';

  if (state.status === 'done') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Product created. It is live in the catalogue and visible on the products page.
      </p>
    );
  }

  const toggleCurrency = (code: CurrencyCode) => {
    setCurrencies((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  return (
    <form action={action} className="space-y-6">
      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product code" error={state.fieldErrors['code']} required>
          <Input name="code" placeholder="savings-plus" required pattern="[a-z0-9-]+" />
        </Field>
        <Field label="Name" error={state.fieldErrors['name']} required>
          <Input name="name" placeholder="Savings Plus" required />
        </Field>
        <Field label="Kind" error={state.fieldErrors['kind']} required>
          <Select name="kind" required>
            {ACCOUNT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind] ?? kind}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Display order" error={state.fieldErrors['displayOrder']}>
          <Input name="displayOrder" type="number" min={0} defaultValue={100} />
        </Field>
      </div>

      <Field label="Tagline" error={state.fieldErrors['tagline']} required>
        <Input name="tagline" placeholder="Everyday savings that grow with you" required />
      </Field>
      <Field label="Description" error={state.fieldErrors['description']} required>
        <Textarea name="description" rows={3} required />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium">Currencies</legend>
        <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
          The first selected currency is used for the limits and fee below.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {CURRENCY_CODES.map((code) => (
            <Checkbox
              key={code}
              name="currencies"
              value={code}
              label={code}
              checked={currencies.includes(code)}
              onChange={() => toggleCurrency(code)}
            />
          ))}
        </div>
        {state.fieldErrors['currencies'] ? (
          <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {state.fieldErrors['currencies']}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Interest rate (% per year)"
          error={state.fieldErrors['interestRate']}
          description="Leave empty for a non-interest product."
        >
          <Input name="interestRate" type="number" step="0.01" min={0} max={100} />
        </Field>
        <MoneyField
          name="monthlyFee"
          label="Monthly fee"
          currency={primary}
          description="Empty means free."
        />
        <MoneyField name="minimumOpeningBalance" label="Minimum opening balance" currency={primary} />
        <MoneyField name="minimumBalance" label="Minimum ongoing balance" currency={primary} />
      </div>

      <Field
        label="Features"
        error={state.fieldErrors['features']}
        description="One per line, as they appear on the public site."
      >
        <Textarea name="features" rows={4} placeholder={'No monthly fee\nFree instant transfers'} />
      </Field>

      <EligibilityFieldset />

      <Button type="submit" loading={pending}>
        {pending ? 'Creating…' : 'Create product'}
      </Button>
    </form>
  );
}

/** Who may open the product; empty values mean "no restriction", chosen deliberately. */
function EligibilityFieldset() {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Eligibility</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Field label="Minimum age" description="Empty means no age restriction.">
          <Input name="minimumAge" type="number" min={0} max={120} />
        </Field>
        <Field label="Minimum KYC tier">
          <Select name="minimumKycLevel" defaultValue="">
            <option value="">No requirement</option>
            <option value="tier_1">Tier 1</option>
            <option value="tier_2">Tier 2</option>
            <option value="tier_3">Tier 3</option>
          </Select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox name="residentsOnly" label="Residents only" />
        <Checkbox name="businessOnly" label="Business customers only" />
      </div>
    </fieldset>
  );
}
