'use client';

import type { AccountSummary, LoanProduct, LoanQuote } from '@icb/contracts';
import { Amount, Button, formatDate } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';

import { FormError, MoneyField, SelectField, TextField } from '../form-controls';
import { applyForLoanAction, type ApplyState } from './actions';
import type { Route } from 'next';

const IDLE: ApplyState = { error: null, fieldErrors: {}, applicationId: null };

export const PURPOSES = [
  { value: 'home_improvement', label: 'Home improvement' },
  { value: 'debt_consolidation', label: 'Debt consolidation' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'education', label: 'Education' },
  { value: 'medical', label: 'Medical' },
  { value: 'business', label: 'Business' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Something else' },
] as const;

/**
 * Steps three and four of the application: the financial declaration the underwriter scores,
 * then a final review before the submit that triggers the real decision.
 */
export function DetailsAndReview({
  step,
  product,
  quote,
  accounts,
  amountDraft,
  termMonths,
  onBack,
  onNext,
}: Readonly<{
  step: number;
  product: LoanProduct;
  quote: LoanQuote;
  accounts: AccountSummary[];
  amountDraft: string;
  termMonths: number;
  onBack: () => void;
  onNext: () => void;
}>) {
  const [state, action, pending] = useActionState(applyForLoanAction, IDLE);
  const router = useRouter();

  useEffect(() => {
    if (state.applicationId) {
      router.push(`/loans/applications/${state.applicationId}` as Route);
    }
  }, [state.applicationId, router]);

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.nickname ?? account.productName} · ${account.identifiers.number.slice(-4)}`,
  }));

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="productCode" value={product.code} />
      <input type="hidden" name="amount" value={amountDraft} />
      <input type="hidden" name="currency" value={product.currency} />
      <input type="hidden" name="termMonths" value={termMonths} />
      <FormError message={state.error} />

      <QuoteSummary quote={quote} />

      {step === 3 ? (
        <>
          <SelectField label="Purpose" name="purpose" options={[...PURPOSES]} />
          <TextField
            label="Tell us a little more"
            name="purposeDetail"
            hint="(optional)"
            maxLength={500}
          />
          <SelectField
            label="Pay the loan into"
            name="disbursementAccountId"
            options={accountOptions}
            error={state.fieldErrors['disbursementAccountId']}
          />
          <SelectField
            label="Take repayments from"
            name="repaymentAccountId"
            options={accountOptions}
            error={state.fieldErrors['repaymentAccountId']}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField
              label="Monthly income"
              name="declaredMonthlyIncome"
              currency={product.currency}
              error={state.fieldErrors['declaredMonthlyIncome']}
            />
            <MoneyField
              label="Monthly expenses"
              name="declaredMonthlyExpenses"
              currency={product.currency}
              error={state.fieldErrors['declaredMonthlyExpenses']}
            />
            <MoneyField
              label="Existing loan payments"
              name="existingCommitments"
              currency={product.currency}
              error={state.fieldErrors['existingCommitments']}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={onNext}>
              Review application
            </Button>
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-[var(--icb-text-subtle)]">
            Submitting runs a full affordability and credit assessment. The indicative rate above
            is not the final offer — the decision, with its reasons, comes back on the next
            screen.
          </p>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={pending}>
              Submit application
            </Button>
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

function QuoteSummary({ quote }: Readonly<{ quote: LoanQuote }>) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--icb-bg-subtle)] p-4">
      <p className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-[var(--icb-text-subtle)]">Monthly instalment</span>
        <Amount value={quote.instalment} size="lg" />
      </p>
      <dl className="mt-3 space-y-1.5 border-t border-[var(--icb-border)] pt-3 text-xs text-[var(--icb-text-muted)]">
        <p className="flex justify-between">
          <dt>Rate (representative APR {quote.representativeApr}%)</dt>
          <dd className="tabular">{quote.nominalRate}% nominal</dd>
        </p>
        <p className="flex justify-between">
          <dt>Arrangement fee</dt>
          <dd>
            <Amount value={quote.arrangementFee} size="sm" />
          </dd>
        </p>
        <p className="flex justify-between">
          <dt>Total repayable</dt>
          <dd>
            <Amount value={quote.totalRepayable} size="sm" />
          </dd>
        </p>
        <p className="flex justify-between">
          <dt>First payment</dt>
          <dd>{formatDate(quote.firstPaymentOn, 'medium')}</dd>
        </p>
      </dl>
    </div>
  );
}
