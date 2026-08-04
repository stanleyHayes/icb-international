'use client';

import { Button, Field, Input, Select } from '@icb/ui';
import { useActionState } from 'react';

import { FormAlert } from './form-alert';
import { saveIdentityAction } from './onboarding-actions';
import type { AuthFormState } from './password-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

const INCOME_BANDS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'under_25k', label: 'Under 25,000' },
  { value: '25k_50k', label: '25,000 – 50,000' },
  { value: '50k_100k', label: '50,000 – 100,000' },
  { value: '100k_250k', label: '100,000 – 250,000' },
  { value: 'over_250k', label: 'Over 250,000' },
] as const;

interface IdentityFormProps {
  firstName: string;
  lastName: string;
}

/**
 * Onboarding step one: the person behind the login.
 *
 * Everything here feeds the verification case an analyst reviews — which the copy says, because
 * asking for a date of birth without saying why is how you teach customers to lie.
 */
export function IdentityForm({ firstName, lastName }: Readonly<IdentityFormProps>) {
  const [state, action, pending] = useActionState(saveIdentityAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" error={state.fieldErrors['individual.firstName']} required>
          <Input name="firstName" autoComplete="given-name" defaultValue={firstName} required />
        </Field>
        <Field label="Last name" error={state.fieldErrors['individual.lastName']} required>
          <Input name="lastName" autoComplete="family-name" defaultValue={lastName} required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Date of birth"
          error={state.fieldErrors['individual.dateOfBirth']}
          required
        >
          <Input name="dateOfBirth" type="date" autoComplete="bday" required />
        </Field>
        <Field
          label="Nationality"
          description="Two-letter country code, e.g. GH or GB."
          error={state.fieldErrors['individual.nationality']}
          required
        >
          <Input
            name="nationality"
            minLength={2}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            autoCapitalize="characters"
            placeholder="GH"
            required
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Occupation" error={state.fieldErrors['individual.occupation']}>
          <Input name="occupation" autoComplete="organization-title" />
        </Field>
        <Field label="Annual income" error={state.fieldErrors['individual.annualIncomeBand']}>
          <Select name="annualIncomeBand" defaultValue="">
            {INCOME_BANDS.map((band) => (
              <option key={band.value} value={band.value}>
                {band.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-5 border-t border-[var(--icb-border)] pt-5">
        <legend className="text-sm font-semibold">Home address</legend>
        <Field label="Street address" error={state.fieldErrors['residentialAddress.line1']} required>
          <Input name="line1" autoComplete="address-line1" required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" error={state.fieldErrors['residentialAddress.city']} required>
            <Input name="city" autoComplete="address-level2" required />
          </Field>
          <Field label="Region" error={state.fieldErrors['residentialAddress.region']}>
            <Input name="region" autoComplete="address-level1" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Postal code" error={state.fieldErrors['residentialAddress.postalCode']}>
            <Input name="postalCode" autoComplete="postal-code" />
          </Field>
          <Field
            label="Country"
            description="Two-letter country code."
            error={state.fieldErrors['residentialAddress.country']}
            required
          >
            <Input
              name="country"
              minLength={2}
              maxLength={2}
              pattern="[A-Za-z]{2}"
              autoCapitalize="characters"
              autoComplete="country"
              placeholder="GH"
              required
            />
          </Field>
        </div>
      </fieldset>

      <Button type="submit" size="lg" loading={pending}>
        {pending ? 'Saving…' : 'Continue to documents'}
      </Button>
    </form>
  );
}
