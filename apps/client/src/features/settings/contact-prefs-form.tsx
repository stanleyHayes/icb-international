'use client';

import { Field, Select } from '@icb/ui';
import { useActionState } from 'react';

import { SubmitRow } from './form-parts';
import { saveContactPrefsAction, type SettingsActionState } from './profile-actions';

const INITIAL: SettingsActionState = { error: null, done: false };

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'nl', label: 'Nederlands' },
] as const;

const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Rome',
  'Africa/Accra',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

/**
 * Language, timezone and statement delivery. The customer's stored timezone is always offered
 * even when it is outside the common list — a select that drops the current value is a data
 * loss bug wearing a UI.
 */
export function ContactPrefsForm({
  initial,
}: Readonly<{
  initial: { locale: string; timezone: string; statementDelivery: string };
}>) {
  const [state, action, pending] = useActionState(saveContactPrefsAction, INITIAL);
  const timezones = TIMEZONES.includes(initial.timezone as (typeof TIMEZONES)[number])
    ? TIMEZONES
    : [initial.timezone, ...TIMEZONES];

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Language">
          <Select name="locale" defaultValue={initial.locale}>
            {LOCALES.map((locale) => (
              <option key={locale.value} value={locale.value}>
                {locale.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Timezone" description="Used for statement dates and quiet hours.">
          <Select name="timezone" defaultValue={initial.timezone}>
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Statement delivery">
        <Select name="statementDelivery" defaultValue={initial.statementDelivery}>
          <option value="both">Email and in-app</option>
          <option value="email">Email only</option>
          <option value="in_app">In-app only</option>
        </Select>
      </Field>

      <SubmitRow pending={pending} label="Save preferences" state={state} doneText="Preferences saved." />
    </form>
  );
}
