'use client';

import type { CurrencyCode } from '@icb/money';
import { Button, Field, MoneyInput, Textarea } from '@icb/ui';
import { useState } from 'react';

import { setOverdraftLimit } from '@/features/accounts/actions';
import { OpMessage, useOpForm } from '@/features/accounts/use-op-form';

/** Overdraft limit decision, entered as integer minor units — never a float (N3). */
export function OverdraftForm({
  accountId,
  currency,
  currentMinorUnits,
}: Readonly<{ accountId: string; currency: CurrencyCode; currentMinorUnits: number }>) {
  const [limit, setLimit] = useState<number | null>(currentMinorUnits);
  const [reason, setReason] = useState('');
  const form = useOpForm(setOverdraftLimit);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (limit === null) return;
        form.submit({ accountId, currency, minorUnits: limit, reason });
      }}
    >
      <Field label="New limit" required>
        <MoneyInput name="limit" currency={currency} value={limit} onChange={setLimit} required />
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
      <Button type="submit" disabled={form.pending || limit === null}>
        {form.pending ? 'Updating…' : 'Update limit'}
      </Button>
    </form>
  );
}
