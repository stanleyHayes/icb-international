'use client';

import { Button, Field, Input, Select } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { generateStatementAction, type DocumentActionState } from './actions';

const INITIAL: DocumentActionState = { error: null, done: false };

export interface AccountOption {
  id: string;
  label: string;
}

/**
 * Generate a statement for any window. Both dates are inclusive; the API refuses an account
 * that is not the customer's own, so the select is populated only with their accounts.
 */
export function StatementGenerateForm({
  accounts,
}: Readonly<{ accounts: readonly AccountOption[] }>) {
  const [state, action, pending] = useActionState(generateStatementAction, INITIAL);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
      <Field label="Account" required>
        <Select name="accountId" required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="From" required>
        <Input type="date" name="from" required />
      </Field>
      <Field label="To" required>
        <Input type="date" name="to" required />
      </Field>
      <Button type="submit" loading={pending}>
        Generate
      </Button>

      <FormFeedback state={state} doneText="Statement generated — it appears in the list above." />
    </form>
  );
}

/** Shared inline result line for the documents forms. */
export function FormFeedback({
  state,
  doneText,
}: Readonly<{ state: DocumentActionState; doneText: string }>) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-sm text-[var(--icb-danger-fg)] sm:col-span-4">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state.done) {
    return (
      <p role="status" className="flex items-start gap-1.5 text-sm text-[var(--icb-success-fg)] sm:col-span-4">
        <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        {doneText}
      </p>
    );
  }
  return null;
}
