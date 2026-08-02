'use client';

import type { AccountSummary, TransferSummary } from '@icb/contracts';
import { Amount, Button, maskIdentifier } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { createTransferAction, type TransferState } from './actions';

/**
 * Initial state lives here, not in the action module: a file marked `'use server'` may only
 * export async functions, so a plain object exported from there arrives as undefined.
 */
const TRANSFER_INITIAL: TransferState = {
  status: 'idle',
  message: null,
  transfer: null,
  fieldErrors: {},
};

export function TransferForm({ accounts }: Readonly<{ accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(createTransferAction, TRANSFER_INITIAL);
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '');
  const [kind, setKind] = useState<'own_account' | 'icb_customer'>('own_account');

  const from = accounts.find((account) => account.id === fromId) ?? accounts[0];
  const others = accounts.filter((account) => account.id !== fromId);
  const currency = from?.currency ?? 'USD';

  const fromField = useId();
  const toField = useId();
  const amountField = useId();
  const referenceField = useId();

  if (state.status === 'success' && state.transfer) {
    return <TransferReceipt transfer={state.transfer} />;
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError message={state.message} />

      <div>
        <label htmlFor={fromField} className="block text-sm font-medium">
          From
        </label>
        <select
          id={fromField}
          name="fromAccountId"
          value={fromId}
          onChange={(event) => setFromId(event.target.value)}
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.nickname ?? account.productName} · {maskIdentifier(account.identifiers.number)}
            </option>
          ))}
        </select>
        {from ? (
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Available <Amount value={from.balances.available} size="sm" />
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium">To</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <ChoiceButton
            active={kind === 'own_account'}
            onClick={() => setKind('own_account')}
            label="My account"
          />
          <ChoiceButton
            active={kind === 'icb_customer'}
            onClick={() => setKind('icb_customer')}
            label="ICB customer"
          />
        </div>
        <input type="hidden" name="destinationKind" value={kind} />
      </fieldset>

      <DestinationField
        kind={kind}
        fieldId={toField}
        accounts={others}
        error={state.fieldErrors['toAccountNumber']}
      />

      <AmountField
        fieldId={amountField}
        currency={currency}
        error={state.fieldErrors['amount']}
      />

      <div>
        <label htmlFor={referenceField} className="block text-sm font-medium">
          Reference <span className="font-normal text-[var(--icb-text-subtle)]">(optional)</span>
        </label>
        <input
          id={referenceField}
          name="reference"
          maxLength={140}
          placeholder="What is this for?"
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
      </div>

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Sending…' : 'Send transfer'}
      </Button>
    </form>
  );
}

/** Form-level failure, e.g. insufficient funds returned by the API. */
function FormError({ message }: Readonly<{ message: string | null }>) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

function ChoiceButton({
  active,
  onClick,
  label,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  label: string;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'h-10 rounded-[var(--radius-md)] border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] text-sm font-medium text-[var(--icb-primary)]'
          : 'h-10 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] text-sm font-medium text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)]'
      }
    >
      {label}
    </button>
  );
}

function TransferReceipt({ transfer }: Readonly<{ transfer: TransferSummary }>) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]">
        <CheckCircle2 size={24} />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Transfer sent</h3>
      <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
        {transfer.recipientName} · {transfer.recipientMasked}
      </p>
      <p className="mt-5">
        <Amount value={transfer.debitAmount} size="xl" />
      </p>
      <p className="mt-4 font-mono text-xs text-[var(--icb-text-subtle)]">
        {transfer.reference} · {transfer.rail.replace('_', '-')}
      </p>
      <Button
        variant="secondary"
        className="mt-6"
        onClick={() => {
          window.location.reload();
        }}
      >
        Make another transfer
      </Button>
    </div>
  );
}

/** The destination changes shape with the chosen rail; each branch renders only its own inputs. */
function DestinationField({
  kind,
  fieldId,
  accounts,
  error,
}: Readonly<{
  kind: 'own_account' | 'icb_customer';
  fieldId: string;
  accounts: AccountSummary[];
  error?: string | undefined;
}>) {
  if (kind === 'own_account') {
    return (
      <div>
        <label htmlFor={fieldId} className="block text-sm font-medium">
          Destination account
        </label>
        <select
          id={fieldId}
          name="toAccountId"
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm outline-none focus:border-[var(--icb-primary)]"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.nickname ?? account.productName} ·{' '}
              {maskIdentifier(account.identifiers.number)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium">
        ICB account number
      </label>
      <input
        id={fieldId}
        name="toAccountNumber"
        inputMode="numeric"
        pattern="\\d{10}"
        placeholder="10 digits"
        className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 font-mono text-sm outline-none focus:border-[var(--icb-primary)]"
      />
      {error ? <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p> : null}
    </div>
  );
}

/** Amounts are typed as decimal text and parsed to minor units server-side, never as a float. */
function AmountField({
  fieldId,
  currency,
  error,
}: Readonly<{ fieldId: string; currency: string; error?: string | undefined }>) {
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium">
        Amount
      </label>
      <div className="relative mt-1.5">
        <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-[var(--icb-text-subtle)]">
          {currency}
        </span>
        <input
          id={fieldId}
          name="amount"
          inputMode="decimal"
          placeholder="0.00"
          required
          className="tabular h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] pr-3.5 pl-14 text-right text-lg font-semibold outline-none focus:border-[var(--icb-primary)]"
        />
      </div>
      <input type="hidden" name="currency" value={currency} />
      {error ? <p className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">{error}</p> : null}
    </div>
  );
}
