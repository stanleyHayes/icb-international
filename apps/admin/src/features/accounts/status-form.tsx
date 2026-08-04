'use client';

import { Button, Field, Select, Textarea } from '@icb/ui';
import { useState } from 'react';

import { setAccountStatus } from '@/features/accounts/actions';
import { OpMessage, useOpForm } from '@/features/accounts/use-op-form';

const TRANSITIONS = [
  { value: 'active', label: 'Activate / unfreeze' },
  { value: 'frozen', label: 'Freeze' },
  { value: 'dormant', label: 'Mark dormant' },
  { value: 'closed', label: 'Close account' },
] as const;

/**
 * Staff lifecycle transition. The reachable states come from the API's state machine; the form
 * simply refuses to offer the state the account is already in.
 */
export function StatusForm({
  accountId,
  currentStatus,
}: Readonly<{ accountId: string; currentStatus: string }>) {
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const form = useOpForm(setAccountStatus);
  const options = TRANSITIONS.filter((option) => option.value !== currentStatus);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit({ accountId, status, reason });
      }}
    >
      <Field label="New status" required>
        <Select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          required
        >
          <option value="" disabled>
            Choose a transition
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
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
      <Button type="submit" disabled={form.pending || status === ''}>
        {form.pending ? 'Updating…' : 'Update status'}
      </Button>
    </form>
  );
}
