'use client';

import { Checkbox, Field, Input, PasswordInput, PhoneInput, Select } from '@icb/ui';
import { listCurrencies } from '@icb/money';
import { Controller, useFormContext } from 'react-hook-form';

import type { ApplicationDraft } from './schema';

const CURRENCIES = listCurrencies();

/** Step 1 — the account the applicant wants, as intent: currency now, savings after sign-in. */
export function ProductStep() {
  const { register, control, formState } = useFormContext<ApplicationDraft>();
  return (
    <div className="space-y-5">
      <Field
        label="Account currency"
        description="Your Everyday Current account is opened in this currency. You can hold fifteen currencies and switch later."
        error={formState.errors.currency?.message}
        required
      >
        <Select {...register('currency')} size="lg">
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
            </option>
          ))}
        </Select>
      </Field>

      <Controller
        control={control}
        name="addSavings"
        render={({ field }) => (
          <div className="rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-4 py-3.5">
            <Checkbox
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
              onBlur={field.onBlur}
              name={field.name}
              label={
                <span>
                  <span className="block text-sm font-medium">
                    Add Reserve Savings at 4.15% AER
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
                    Opened in one tap once you sign in — interest accrues daily, no minimum
                    balance.
                  </span>
                </span>
              }
            />
          </div>
        )}
      />
    </div>
  );
}

/** Step 2 — the applicant's legal name, as it appears on their identity document. */
export function PersonalStep() {
  const { register, formState } = useFormContext<ApplicationDraft>();
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" error={formState.errors.firstName?.message} required>
          <Input {...register('firstName')} autoComplete="given-name" size="lg" />
        </Field>
        <Field label="Last name" error={formState.errors.lastName?.message} required>
          <Input {...register('lastName')} autoComplete="family-name" size="lg" />
        </Field>
      </div>
      <p className="text-xs leading-relaxed text-[var(--icb-text-subtle)]">
        Use the name on your passport or national ID — it is checked against your document when
        you verify your identity.
      </p>
    </div>
  );
}

/** Step 3 — how the applicant signs in and how the bank reaches them. */
export function IdentityStep() {
  const { register, control, formState } = useFormContext<ApplicationDraft>();
  return (
    <div className="space-y-5">
      <Field label="Email" error={formState.errors.email?.message} required>
        <Input
          {...register('email')}
          type="email"
          autoComplete="email"
          size="lg"
          placeholder="you@example.com"
        />
      </Field>

      <Field
        label="Mobile number"
        description="Used for sign-in codes and security alerts."
        error={formState.errors.phone?.message}
        required
      >
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />
      </Field>

      <Field
        label="Password"
        description="At least 12 characters, with upper and lower case letters and a digit."
        error={formState.errors.password?.message}
        required
      >
        <PasswordInput {...register('password')} autoComplete="new-password" size="lg" />
      </Field>
    </div>
  );
}
