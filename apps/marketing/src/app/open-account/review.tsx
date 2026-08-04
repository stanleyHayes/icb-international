'use client';

import { Checkbox, DefinitionList } from '@icb/ui';
import { Controller, useFormContext } from 'react-hook-form';

import { FUNNEL_STEPS, type ApplicationDraft } from './schema';

/**
 * Step 4 — everything read back before submission.
 *
 * Nothing here is a surprise at the API: each row has an Edit control that jumps back to the
 * step owning the field, and the draft survives the jump because react-hook-form holds it.
 */
export function ReviewStep({ onEdit }: Readonly<{ onEdit: (step: number) => void }>) {
  const { control, getValues, formState } = useFormContext<ApplicationDraft>();
  const values = getValues();

  const rows = [
    { term: 'Account', value: `Everyday Current · ${values.currency}`, step: 0 },
    {
      term: 'Savings',
      value: values.addSavings ? 'Reserve Savings, added after sign-in' : 'Not added',
      step: 0,
    },
    { term: 'Name', value: `${values.firstName} ${values.lastName}`, step: 1 },
    { term: 'Email', value: values.email, step: 2 },
    { term: 'Mobile', value: values.phone, step: 2 },
  ];

  return (
    <div className="space-y-6">
      <DefinitionList
        items={rows.map((row) => ({
          id: row.term,
          term: row.term,
          description: (
            <span className="flex items-baseline justify-between gap-4">
              <span>{row.value}</span>
              <button
                type="button"
                onClick={() => onEdit(row.step)}
                className="shrink-0 rounded text-xs font-medium text-[var(--icb-primary)] hover:underline"
                aria-label={`Edit ${row.term.toLowerCase()} — go to ${FUNNEL_STEPS[row.step]?.title ?? 'step'}`}
              >
                Edit
              </button>
            </span>
          ),
        }))}
      />

      <div>
        <Controller
          control={control}
          name="acceptedTerms"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
              onBlur={field.onBlur}
              name={field.name}
              invalid={formState.errors.acceptedTerms != null}
              aria-describedby={
                formState.errors.acceptedTerms != null ? 'terms-error' : undefined
              }
              label={
                <span className="text-sm text-[var(--icb-text-muted)]">
                  I accept the{' '}
                  <a href="/legal/terms" className="font-medium text-[var(--icb-primary)] hover:underline">
                    account terms
                  </a>{' '}
                  and{' '}
                  <a href="/legal/privacy" className="font-medium text-[var(--icb-primary)] hover:underline">
                    privacy notice
                  </a>
                  .
                </span>
              }
            />
          )}
        />
        {formState.errors.acceptedTerms ? (
          <p id="terms-error" role="alert" className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {formState.errors.acceptedTerms.message}
          </p>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-[var(--icb-text-subtle)]">
        We will verify your identity before the account can send money — a document and a selfie,
        once you sign in. Your email is verified first: a link is on its way when you confirm.
      </p>
    </div>
  );
}
