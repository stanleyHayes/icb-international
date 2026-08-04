'use client';

import type { CurrencyCode } from '@icb/money';
import { Button, Field, Input, MoneyInput, RadioGroup, Textarea } from '@icb/ui';
import { useState } from 'react';

import { submitManualPosting } from '@/features/accounts/actions';
import { OpMessage, useOpForm } from '@/features/accounts/use-op-form';

/**
 * Manual credit/debit.
 *
 * Nothing here posts directly: submitting raises an approval request and the entry only hits the
 * ledger once a second operator approves it in the inbox. The form says so plainly, because an
 * operator who thinks the money has already moved will promise things it cannot keep.
 */
export function ManualPostingForm({
  accountId,
  currency,
}: Readonly<{ accountId: string; currency: CurrencyCode }>) {
  const [direction, setDirection] = useState<'debit' | 'credit'>('credit');
  const [amount, setAmount] = useState<number | null>(null);
  const [contra, setContra] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const form = useOpForm(submitManualPosting);

  const submit = () => {
    if (amount === null) return;
    form.submit({
      accountId,
      currency,
      direction,
      minorUnits: amount,
      contraAccountCode: contra,
      description,
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
      <Field label="Direction" required>
        <RadioGroup
          name="direction"
          orientation="horizontal"
          value={direction}
          onChange={(value) => setDirection(value as 'debit' | 'credit')}
          options={[
            { value: 'credit', label: 'Credit the account' },
            { value: 'debit', label: 'Debit the account' },
          ]}
        />
      </Field>
      <Field label="Amount" required error={form.fieldErrors.amount}>
        <MoneyInput name="amount" currency={currency} value={amount} onChange={setAmount} required />
      </Field>
      <Field
        label="Contra account code"
        required
        error={form.fieldErrors.contraAccountCode}
        description="The internal four-digit ledger code forming the other leg."
      >
        <Input
          name="contraAccountCode"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={contra}
          onChange={(event) => setContra(event.target.value)}
          required
        />
      </Field>
      <Field label="Narrative" required error={form.fieldErrors.description}>
        <Input
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </Field>
      <Field
        label="Reason"
        required
        error={form.fieldErrors.reason}
        description="Reviewed by the approving operator and kept in the audit trail."
      >
        <Textarea
          name="reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <OpMessage done={form.done} message={form.message} />
      <Button type="submit" disabled={form.pending || amount === null}>
        {form.pending ? 'Submitting…' : 'Submit for approval'}
      </Button>
    </form>
  );
}
