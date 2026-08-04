'use client';

import type { AccountSummary, LoanDetail } from '@icb/contracts';
import { Button, maskIdentifier, minorUnitsToDraft } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useActionState, useState } from 'react';

import { FormError, MoneyField, SelectField } from '../form-controls';
import { acceptOfferAction, makeRepaymentAction, type LoanActionState } from './actions';

const IDLE: LoanActionState = { error: null, saved: false };

const REPAY_KINDS = [
  { value: 'scheduled', label: 'Pay the next instalment' },
  { value: 'extra', label: 'Extra payment off the principal' },
  { value: 'payoff', label: 'Settle the loan in full' },
] as const;

/**
 * A repayment against an active loan. Extra payments reduce principal, which is where the
 * interest saving lives — the kind is chosen explicitly rather than inferred from the amount.
 */
export function RepayForm({
  loan,
  accounts,
}: Readonly<{ loan: LoanDetail; accounts: AccountSummary[] }>) {
  const [state, action, pending] = useActionState(makeRepaymentAction, IDLE);
  const [kind, setKind] = useState<'scheduled' | 'extra' | 'payoff'>('scheduled');
  const currency = loan.totalOutstanding.currency;

  const defaultAmount = defaultAmountFor(kind, loan);

  return (
    <form action={action} className="space-y-4" noValidate key={kind}>
      <input type="hidden" name="loanId" value={loan.id} />
      <input type="hidden" name="currency" value={currency} />
      <FormError message={state.error} />

      <SelectField
        label="Payment from"
        name="fromAccountId"
        defaultValue={loan.repaymentAccountId}
        options={accounts.map((account) => ({
          value: account.id,
          label: `${account.nickname ?? account.productName} · ${maskIdentifier(account.identifiers.number)}`,
        }))}
      />

      <fieldset>
        <legend className="text-sm font-medium">What kind of payment</legend>
        <div className="mt-2 space-y-2">
          {REPAY_KINDS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3 py-2.5 text-sm has-checked:border-[var(--icb-primary)] has-checked:bg-[var(--icb-navy-50)]"
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="accent-[var(--icb-primary)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <MoneyField
        label="Amount"
        name="amount"
        currency={currency}
        defaultValue={defaultAmount == null ? '' : minorUnitsToDraft(defaultAmount, currency)}
      />
      {kind === 'extra' ? (
        <p className="text-xs text-[var(--icb-text-subtle)]">
          Extra payments come straight off the principal, so they save interest from day one.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Make payment
        </Button>
        {state.saved && !pending ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--icb-success-fg)]" role="status">
            <CheckCircle2 size={14} />
            Payment made
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** The sensible prefill for each repayment kind; extra payments start blank. */
function defaultAmountFor(kind: 'scheduled' | 'extra' | 'payoff', loan: LoanDetail): number | null {
  if (kind === 'scheduled') {
    return loan.nextPaymentAmount?.minorUnits ?? null;
  }
  if (kind === 'payoff') {
    return loan.totalOutstanding.minorUnits;
  }
  return null;
}

/** Accept an approved offer before it lapses; accepting is what creates the loan. */
export function AcceptOfferButton({ applicationId }: Readonly<{ applicationId: string }>) {
  const [state, action, pending] = useActionState(acceptOfferAction, IDLE);

  if (state.saved) {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 text-sm text-[var(--icb-success-fg)]"
      >
        <CheckCircle2 size={16} />
        Offer accepted — the loan is being set up and the money is on its way.
      </p>
    );
  }

  return (
    <form action={action} noValidate>
      <input type="hidden" name="applicationId" value={applicationId} />
      <FormError message={state.error} />
      <Button type="submit" loading={pending}>
        Accept this offer
      </Button>
    </form>
  );
}
