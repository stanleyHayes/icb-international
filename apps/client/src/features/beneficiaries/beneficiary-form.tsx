'use client';

import { Button, Checkbox, Field, Input, RadioGroup } from '@icb/ui';
import { AlertCircle, Info } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createBeneficiaryAction } from './actions';
import {
  INITIAL_FIELDS,
  buildPayeeDestination,
  type FormFields,
  type PayeeKind,
} from './beneficiary-form-types';
import { PayeeDestinationFields } from './payee-destination-fields';

/**
 * Add a payee. The cooling-off notice is shown up front, not discovered at transfer time —
 * the cap on first-day transfers to a brand-new payee is what blunts APP fraud.
 */
export function BeneficiaryForm() {
  const router = useRouter();
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<FormFields>) =>
    setFields((current) => ({ ...current, ...changes }));

  const ready = fields.name.trim().length > 0 && buildPayeeDestination(fields) !== null;

  async function submit() {
    const destination = buildPayeeDestination(fields);
    if (!destination) {
      setError('Check the account details and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createBeneficiaryAction({
      nickname: fields.nickname,
      name: fields.name,
      favourite: fields.favourite,
      destination,
    });
    setBusy(false);
    if (result.ok) {
      router.push(`/beneficiaries/${result.beneficiary.id}` as Route);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] px-4 py-3 text-sm text-[var(--icb-text-muted)]">
        <Info size={16} className="mt-0.5 shrink-0 text-[var(--icb-primary)]" />
        New payees have a short cooling-off window. Transfers to them are limited for the first
        few hours — this protects you if anyone else ever adds a payee to your account.
      </p>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <Field label="Their full name" required>
        <Input
          value={fields.name}
          onChange={(event) => patch({ name: event.target.value })}
          maxLength={140}
          autoComplete="off"
        />
      </Field>

      <Field label="Nickname" description="How this payee appears in your lists. Optional.">
        <Input
          value={fields.nickname}
          onChange={(event) => patch({ nickname: event.target.value })}
          maxLength={60}
          placeholder="e.g. Landlord"
        />
      </Field>

      <RadioGroup
        name="payee-kind"
        value={fields.kind}
        onChange={(kind) => patch({ kind: kind as PayeeKind })}
        options={[
          {
            value: 'domestic_bank',
            label: 'Another bank',
            description: 'Sort code and account number.',
          },
          {
            value: 'icb_customer',
            label: 'ICB customer',
            description: 'A 10-digit ICB account number.',
          },
          { value: 'international', label: 'International', description: 'IBAN and SWIFT/BIC.' },
        ]}
      />

      <PayeeDestinationFields fields={fields} patch={patch} />

      <Checkbox
        label="Mark as favourite"
        checked={fields.favourite}
        onChange={(event) => patch({ favourite: event.target.checked })}
      />

      <Button size="lg" block disabled={!ready || busy} loading={busy} onClick={() => void submit()}>
        {busy ? 'Saving…' : 'Save payee'}
      </Button>
    </div>
  );
}
