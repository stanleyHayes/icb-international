'use client';

import { Button, Field, Input } from '@icb/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Jump straight to an account when the operator already has its id on the screen in front of them. */
export function AccountLookup() {
  const router = useRouter();
  const [accountId, setAccountId] = useState('');

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const id = accountId.trim();
        if (id) router.push(`/accounts/${encodeURIComponent(id)}` as Route);
      }}
    >
      <Field label="Account id" className="flex-1">
        <Input
          name="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          placeholder="acc_…"
          spellCheck={false}
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={accountId.trim() === ''}>
        Open
      </Button>
    </form>
  );
}
