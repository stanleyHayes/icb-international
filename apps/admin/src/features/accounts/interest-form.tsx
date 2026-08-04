'use client';

import { Button, Field, Input, Textarea } from '@icb/ui';
import { useState } from 'react';

import { setInterestOverride } from '@/features/accounts/actions';
import { OpMessage, useOpForm } from '@/features/accounts/use-op-form';

/**
 * Per-account interest override. An empty rate clears the override and returns the account to
 * its product's scheduled rate; the reason is mandatory either way because pricing decisions
 * belong in the audit trail.
 */
export function InterestForm({
  accountId,
  currentRate,
}: Readonly<{ accountId: string; currentRate: number | null }>) {
  const [rate, setRate] = useState(currentRate === null ? '' : String(currentRate));
  const [reason, setReason] = useState('');
  const form = useOpForm(setInterestOverride);

  const submit = () => {
    const trimmed = rate.trim();
    form.submit({
      accountId,
      rate: trimmed === '' ? null : Number.parseFloat(trimmed),
      reason,
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field
        label="Override rate (% per year)"
        error={form.fieldErrors.rate}
        description="Leave empty to clear the override and return to the product rate."
      >
        <Input
          name="rate"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />
      </Field>
      <Field label="Reason" required error={form.fieldErrors.reason}>
        <Textarea
          name="reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <OpMessage done={form.done} message={form.message} />
      <Button type="submit" disabled={form.pending}>
        {form.pending ? 'Applying…' : 'Apply override'}
      </Button>
    </form>
  );
}
