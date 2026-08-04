'use client';

import { Button, Field, Input } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { upsertRateEntryAction } from './rate-actions';
import { IDLE_STATE } from './types';

/**
 * Publish a content rate override. Upserts by product code, so the form serves both "add" and
 * "correct": saving a code that already has an entry replaces it.
 */
export function RateForm() {
  const [state, action, pending] = useActionState(upsertRateEntryAction, IDLE_STATE);

  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === 'done' ? (
        <p className="flex items-start gap-2 text-sm text-[var(--icb-success-fg)]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          Rate entry saved — the published table above reflects it on next load.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Product code"
          error={state.fieldErrors['productCode']}
          description="An existing code replaces its entry."
          required
        >
          <Input name="productCode" required maxLength={40} placeholder="e.g. savings-standard" />
        </Field>
        <Field label="Display name" error={state.fieldErrors['name']} required>
          <Input name="name" required maxLength={80} placeholder="e.g. Standard savings" />
        </Field>
        <Field label="Rate (% per year)" error={state.fieldErrors['rate']} required>
          <Input name="rate" type="number" step="0.01" min={0} max={100} required />
        </Field>
        <Field
          label="Effective from"
          error={state.fieldErrors['effectiveFrom']}
          description="The rate applies from this moment."
          required
        >
          <Input name="effectiveFrom" type="datetime-local" required />
        </Field>
      </div>

      <Button type="submit" loading={pending}>
        Save rate entry
      </Button>
    </form>
  );
}
