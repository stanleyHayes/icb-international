'use client';

import { Button, Field, Input, Select } from '@icb/ui';
import { useActionState, useState } from 'react';

import { issueLetterAction, type DocumentActionState } from './actions';
import { FormFeedback, type AccountOption } from './statement-generate-form';

const INITIAL: DocumentActionState = { error: null, done: false };

/**
 * Request a bank letter. A balance confirmation is always about a specific account; a banker's
 * reference may be addressed to a third party (a landlord, an embassy), so that field appears
 * only when it is meaningful.
 */
export function LetterRequestForm({
  accounts,
}: Readonly<{ accounts: readonly AccountOption[] }>) {
  const [state, action, pending] = useActionState(issueLetterAction, INITIAL);
  const [kind, setKind] = useState<'balance_letter' | 'reference_letter'>('balance_letter');

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind of letter" required>
          <Select
            name="kind"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as 'balance_letter' | 'reference_letter')
            }
          >
            <option value="balance_letter">Balance confirmation</option>
            <option value="reference_letter">Banker's reference</option>
          </Select>
        </Field>
        <Field
          label="Account"
          required={kind === 'balance_letter'}
          description={kind === 'balance_letter' ? 'The account whose balance is confirmed.' : undefined}
        >
          <Select name="accountId" required={kind === 'balance_letter'}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {kind === 'reference_letter' ? (
        <Field label="Addressed to" description="For example a landlord or an embassy. Leave blank for yourself.">
          <Input name="addressedTo" maxLength={120} placeholder="To whom it may concern" />
        </Field>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" loading={pending}>
          Request letter
        </Button>
        <FormFeedback state={state} doneText="Letter issued — find it in the list below." />
      </div>
    </form>
  );
}
