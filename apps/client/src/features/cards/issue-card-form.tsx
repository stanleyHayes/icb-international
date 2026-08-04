'use client';

import type { AccountSummary } from '@icb/contracts';
import { Button, maskIdentifier } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { FormError, SelectField, TextField } from '../form-controls';
import { issueCardAction, type IssueCardState } from './issue-actions';
import type { Route } from 'next';

const INITIAL: IssueCardState = { error: null, fieldErrors: {}, cardId: null };

/**
 * Issue a card. A virtual card works the moment it is issued; a physical debit card is ordered
 * against the customer's address on file and must be activated on arrival.
 */
export function IssueCardForm({ accounts }: Readonly<{ accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(issueCardAction, INITIAL);
  const [kind, setKind] = useState<'virtual' | 'debit'>('virtual');
  const router = useRouter();

  useEffect(() => {
    if (state.cardId) {
      router.push(`/cards/${state.cardId}` as Route);
    }
  }, [state.cardId, router]);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.error} />

      <fieldset>
        <legend className="text-sm font-medium">Card type</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <KindChoice
            active={kind === 'virtual'}
            onClick={() => setKind('virtual')}
            title="Virtual"
            description="Issued instantly, for online and in-app spending"
          />
          <KindChoice
            active={kind === 'debit'}
            onClick={() => setKind('debit')}
            title="Physical debit"
            description="Posted to you, works in store and at ATMs"
          />
        </div>
        <input type="hidden" name="kind" value={kind} />
      </fieldset>

      <SelectField
        label="Spends from"
        name="accountId"
        options={accounts.map((account) => ({
          value: account.id,
          label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
        }))}
        error={state.fieldErrors['accountId']}
      />

      <SelectField
        label="Network"
        name="network"
        options={[
          { value: 'visa', label: 'Visa' },
          { value: 'mastercard', label: 'Mastercard' },
        ]}
      />

      <TextField
        label="Name on the card"
        name="nickname"
        hint="(optional)"
        maxLength={60}
        placeholder="e.g. Everyday, Travel"
        error={state.fieldErrors['nickname']}
      />

      {kind === 'debit' ? (
        <SelectField
          label="Deliver to"
          name="deliveryAddressId"
          options={[
            { value: 'residential', label: 'Residential address' },
            { value: 'postal', label: 'Postal address' },
          ]}
        />
      ) : null}

      <Button type="submit" size="lg" block loading={pending}>
        {kind === 'virtual' ? 'Issue virtual card' : 'Order card'}
      </Button>
    </form>
  );
}

function KindChoice({
  active,
  onClick,
  title,
  description,
}: Readonly<{ active: boolean; onClick: () => void; title: string; description: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-[var(--radius-md)] border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] p-3.5 text-left'
          : 'rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] p-3.5 text-left hover:bg-[var(--icb-bg-muted)]'
      }
    >
      <p className={active ? 'text-sm font-semibold text-[var(--icb-primary)]' : 'text-sm font-semibold'}>
        {title}
      </p>
      <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">{description}</p>
    </button>
  );
}
