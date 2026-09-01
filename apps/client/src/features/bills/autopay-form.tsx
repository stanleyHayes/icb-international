'use client';

import type { AccountSummary, LinkedBill } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Button, RadioGroup, Select, maskIdentifier, minorUnitsToDraft } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useState } from 'react';

import { FormError, MoneyField, SelectField, ToggleRow } from '../form-controls';
import { configureAutopayAction, unlinkBillAction, type BillActionState } from './actions';

const IDLE: BillActionState = { status: 'idle', message: null, fieldErrors: {}, billId: null };

const DAY_OPTIONS = [0, 1, 2, 3, 5, 7] as const;

/**
 * Autopay: pay the full balance or a fixed amount, a chosen number of days before the due date,
 * with an optional cap so a runaway bill can never drain the account unnoticed.
 */
export function AutopayForm({
  bill,
  accounts,
}: Readonly<{ bill: LinkedBill; accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(configureAutopayAction, IDLE);
  const [enabled, setEnabled] = useState(bill.autopay?.enabled ?? false);
  const currency = billCurrency(bill, accounts);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="billId" value={bill.id} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="enabled" value={enabled ? 'on' : 'off'} />
      <FormError message={state.status === 'error' ? state.message : null} />

      <ToggleRow
        label="Autopay"
        description="We pay this bill for you before each due date."
        checked={enabled}
        disabled={pending}
        onChange={setEnabled}
      />

      {enabled ? (
        <AutopayDetails
          bill={bill}
          accounts={accounts}
          currency={currency}
          errors={state.fieldErrors}
        />
      ) : null}

      <SaveFooter saved={state.status === 'success' && !pending} pending={pending} />
    </form>
  );
}

function billCurrency(bill: LinkedBill, accounts: AccountSummary[]): CurrencyCode {
  return bill.outstandingBalance?.currency ?? accounts[0]?.currency ?? 'USD';
}

function SaveFooter({ saved, pending }: Readonly<{ saved: boolean; pending: boolean }>) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" loading={pending}>
        Save autopay
      </Button>
      {saved ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--icb-success-fg)]" role="status">
          <CheckCircle2 size={14} />
          Saved
        </p>
      ) : null}
    </div>
  );
}

function AutopayDetails({
  bill,
  accounts,
  currency,
  errors,
}: Readonly<{
  bill: LinkedBill;
  accounts: AccountSummary[];
  currency: CurrencyCode;
  errors: Record<string, string>;
}>) {
  const [strategy, setStrategy] = useState<'full_balance' | 'fixed_amount'>(
    bill.autopay?.strategy ?? 'full_balance',
  );

  return (
    <>
      <SelectField
        label="Pay from"
        name="fromAccountId"
        defaultValue={bill.autopay?.fromAccountId}
        options={accounts.map((account) => ({
          value: account.id,
          label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
        }))}
        error={errors['fromAccountId']}
      />

      <StrategyField strategy={strategy} onChange={setStrategy} />

      <AmountOptions
        autopay={bill.autopay}
        currency={currency}
        errors={errors}
        strategy={strategy}
      />
    </>
  );
}

function AmountOptions({
  autopay,
  currency,
  errors,
  strategy,
}: Readonly<{
  autopay: LinkedBill['autopay'];
  currency: CurrencyCode;
  errors: Record<string, string>;
  strategy: 'full_balance' | 'fixed_amount';
}>) {
  return (
    <>
      {strategy === 'fixed_amount' ? (
        <MoneyField
          label="Fixed amount"
          name="fixedAmount"
          currency={currency}
          defaultValue={draftOrEmpty(autopay?.fixedAmount?.minorUnits, currency)}
          error={errors['fixedAmount']}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <DaysBeforeDueField defaultValue={autopay?.daysBeforeDue ?? 2} />
        <MoneyField
          label="Never pay more than"
          name="capAmount"
          currency={currency}
          hint="(optional)"
          defaultValue={draftOrEmpty(autopay?.capAmount?.minorUnits, currency)}
          error={errors['capAmount']}
        />
      </div>
    </>
  );
}

function StrategyField({
  strategy,
  onChange,
}: Readonly<{
  strategy: 'full_balance' | 'fixed_amount';
  onChange: (value: 'full_balance' | 'fixed_amount') => void;
}>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">How much</legend>
      <RadioGroup
        name="strategy"
        orientation="horizontal"
        value={strategy}
        onChange={(value) => onChange(value as 'full_balance' | 'fixed_amount')}
        className="mt-2"
        options={[
          { value: 'full_balance', label: 'Full balance' },
          { value: 'fixed_amount', label: 'Fixed amount' },
        ]}
      />
    </fieldset>
  );
}

function DaysBeforeDueField({ defaultValue }: Readonly<{ defaultValue: number }>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        Pay this many days before due
      </label>
      <Select id={id} name="daysBeforeDue" defaultValue={defaultValue} className="mt-1.5 h-11">
        {DAY_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {daysLabel(days)}
          </option>
        ))}
      </Select>
    </div>
  );
}

function daysLabel(days: number): string {
  if (days === 0) {
    return 'On the due date';
  }
  return `${days} day${days === 1 ? '' : 's'} before`;
}

/** Remove the bill from the account. History is kept; future reminders stop. */
export function UnlinkBillButton({ billId }: Readonly<{ billId: string }>) {
  const [state, action, pending] = useActionState(unlinkBillAction, IDLE);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      router.push('/bills');
    }
  }, [state.status, router]);

  return (
    <form action={action} noValidate>
      <input type="hidden" name="billId" value={billId} />
      <FormError message={state.status === 'error' ? state.message : null} />
      <Button type="submit" variant="danger" size="sm" loading={pending}>
        Remove this bill
      </Button>
    </form>
  );
}

function draftOrEmpty(
  minorUnits: number | null | undefined,
  currency: CurrencyCode,
): string | undefined {
  return minorUnits == null ? undefined : minorUnitsToDraft(minorUnits, currency);
}
