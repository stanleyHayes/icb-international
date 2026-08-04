'use client';

import type { Address } from '@icb/contracts';
import { Field, Input } from '@icb/ui';
import { useActionState } from 'react';

import { SubmitRow } from './form-parts';
import { saveAddressAction, type SettingsActionState } from './profile-actions';

const INITIAL: SettingsActionState = { error: null, done: false };

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
} as const;

/**
 * One address block. The postal address can be removed by clearing every field — the action
 * turns an empty submission into a null rather than rejecting it, because "no postal address"
 * is a valid answer.
 */
export function AddressForm({
  kind,
  address,
  removable = false,
}: Readonly<{ kind: 'residential' | 'postal'; address: Address | null; removable?: boolean }>) {
  const [state, action, pending] = useActionState(saveAddressAction, INITIAL);
  const values = { ...EMPTY_ADDRESS, ...(address ?? {}) };
  const required = !removable;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />

      <Field label="Address line 1" required={required}>
        <Input name="line1" required={required} maxLength={120} defaultValue={values.line1} />
      </Field>
      <Field label="Address line 2">
        <Input name="line2" maxLength={120} defaultValue={values.line2} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" required={required}>
          <Input name="city" required={required} maxLength={80} defaultValue={values.city} />
        </Field>
        <Field label="Region or state">
          <Input name="region" maxLength={80} defaultValue={values.region} />
        </Field>
        <Field label="Postal code">
          <Input name="postalCode" maxLength={20} defaultValue={values.postalCode} />
        </Field>
        <Field label="Country" required={required} description="Two-letter ISO code, e.g. GH or GB.">
          <Input
            name="country"
            required={required}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            defaultValue={values.country}
            className="uppercase"
          />
        </Field>
      </div>

      {removable ? (
        <p className="text-xs text-[var(--icb-text-subtle)]">
          Clear every field and save to remove your postal address.
        </p>
      ) : null}

      <SubmitRow pending={pending} label="Save address" state={state} doneText="Address saved." />
    </form>
  );
}
