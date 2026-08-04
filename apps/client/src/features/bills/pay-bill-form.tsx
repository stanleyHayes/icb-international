'use client';

import type { AccountSummary, LinkedBill } from '@icb/contracts';
import { Amount, Button, maskIdentifier, minorUnitsToDraft } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useActionState, useId } from 'react';

import { FormError, MoneyField, SelectField } from '../form-controls';
import { payBillAction, type BillActionState } from './actions';

const IDLE: BillActionState = { status: 'idle', message: null, fieldErrors: {}, billId: null };

/**
 * Pay a bill now, or schedule it for a date. The amount defaults to the outstanding balance
 * where the biller reported one — paying what is owed is the common case, not an assumption we
 * should make the customer retype.
 */
export function PayBillForm({
  bill,
  accounts,
}: Readonly<{ bill: LinkedBill; accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(payBillAction, IDLE);
  const dateId = useId();
  const currency = bill.outstandingBalance?.currency ?? accounts[0]?.currency ?? 'USD';

  if (state.status === 'success') {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
      >
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Payment sent. It will appear in your history with the biller&apos;s confirmation
        reference.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="billId" value={bill.id} />
      <input type="hidden" name="currency" value={currency} />
      <FormError message={state.message} />

      <SelectField
        label="Pay from"
        name="fromAccountId"
        options={accounts.map((account) => ({
          value: account.id,
          label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
        }))}
        error={state.fieldErrors['fromAccountId']}
      />

      <MoneyField
        label="Amount"
        name="amount"
        currency={currency}
        defaultValue={
          bill.outstandingBalance
            ? minorUnitsToDraft(bill.outstandingBalance.minorUnits, currency)
            : ''
        }
        error={state.fieldErrors['amount']}
      />

      {bill.outstandingBalance ? (
        <p className="text-xs text-[var(--icb-text-subtle)]">
          Outstanding balance: <Amount value={bill.outstandingBalance} size="sm" />
        </p>
      ) : null}

      <div>
        <label htmlFor={dateId} className="block text-sm font-medium">
          Pay on <span className="font-normal text-[var(--icb-text-subtle)]">(leave blank to pay now)</span>
        </label>
        <input
          id={dateId}
          name="scheduledFor"
          type="date"
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
      </div>

      <Button type="submit" loading={pending}>
        Pay bill
      </Button>
    </form>
  );
}
