'use client';

import { Field, Input, Select } from '@icb/ui';
import { useActionState } from 'react';

import { SubmitRow } from './form-parts';
import { savePersonalDetailsAction, type SettingsActionState } from './profile-actions';

const INITIAL: SettingsActionState = { error: null, done: false };

const INCOME_BANDS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'under_25k', label: 'Under 25,000' },
  { value: '25k_50k', label: '25,000 – 50,000' },
  { value: '50k_100k', label: '50,000 – 100,000' },
  { value: '100k_250k', label: '100,000 – 250,000' },
  { value: 'over_250k', label: 'Over 250,000' },
] as const;

export interface PersonalDetailsInitial {
  firstName: string;
  middleName?: string | undefined;
  lastName: string;
  occupation?: string | undefined;
  employer?: string | undefined;
  annualIncomeBand?: string | undefined;
  phone: string;
}

/**
 * Personal details, contact number and employment. Date of birth and nationality are
 * deliberately not editable here — they are identity facts that change through verification,
 * not through a form.
 */
export function PersonalDetailsForm({
  initial,
}: Readonly<{ initial: PersonalDetailsInitial }>) {
  const [state, action, pending] = useActionState(savePersonalDetailsAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First name" required>
          <Input name="firstName" required maxLength={60} defaultValue={initial.firstName} />
        </Field>
        <Field label="Middle name">
          <Input name="middleName" maxLength={60} defaultValue={initial.middleName ?? ''} />
        </Field>
        <Field label="Last name" required>
          <Input name="lastName" required maxLength={60} defaultValue={initial.lastName} />
        </Field>
      </div>

      <Field label="Phone" description="International format, e.g. +233201234567.">
        <Input name="phone" type="tel" defaultValue={initial.phone} />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium">Employment</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field label="Occupation">
            <Input name="occupation" maxLength={80} defaultValue={initial.occupation ?? ''} />
          </Field>
          <Field label="Employer">
            <Input name="employer" maxLength={120} defaultValue={initial.employer ?? ''} />
          </Field>
        </div>
        <div className="mt-4 sm:max-w-xs">
          <Field label="Annual income">
            <Select name="annualIncomeBand" defaultValue={initial.annualIncomeBand ?? ''}>
              {INCOME_BANDS.map((band) => (
                <option key={band.value} value={band.value}>
                  {band.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <SubmitRow pending={pending} label="Save details" state={state} doneText="Details saved." />
    </form>
  );
}
