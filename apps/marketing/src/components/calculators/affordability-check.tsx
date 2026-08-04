'use client';

import { format, fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Card, CardBody, Field, Input, MoneyInput } from '@icb/ui';
import { useMemo, useState } from 'react';

import { monthlyPaymentMinorUnits } from '@/lib/calculators';

import { CurrencyField, ResultPanel, ResultRow } from './calculator-parts';

/** Debt-service ratio thresholds, as a share of net monthly income. */
const COMFORTABLE_PERCENT = 35;
const STRETCHED_PERCENT = 45;

const DEFAULT_RATE = '8.90';
const DEFAULT_TERM_MONTHS = 36;

interface Verdict {
  readonly label: string;
  readonly className: string;
}

function verdictFor(ratioPercent: number): Verdict {
  if (ratioPercent <= COMFORTABLE_PERCENT) {
    return { label: 'Comfortable', className: 'text-[var(--icb-success-fg)]' };
  }
  if (ratioPercent <= STRETCHED_PERCENT) {
    return { label: 'Stretched', className: 'text-[var(--icb-warning-fg)]' };
  }
  return { label: 'Unlikely to be affordable', className: 'text-[var(--icb-danger-fg)]' };
}

/**
 * Affordability check: would the repayment on a new loan fit beside existing commitments?
 * The ratio is integer minor-unit arithmetic — (commitments + payment) against net income —
 * with the thresholds a lender actually applies, stated next to the verdict.
 */
export function AffordabilityCheck() {
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [income, setIncome] = useState<number | null>(350_000);
  const [commitments, setCommitments] = useState<number | null>(90_000);
  const [amount, setAmount] = useState<number | null>(1_000_000);
  const [rate, setRate] = useState(DEFAULT_RATE);

  const result = useMemo(() => {
    if (income === null || income <= 0 || commitments === null || amount === null || amount <= 0) {
      return null;
    }
    const payment = monthlyPaymentMinorUnits(amount, rate, DEFAULT_TERM_MONTHS);
    if (payment === null) {
      return null;
    }
    const totalService = commitments + payment;
    return {
      payment,
      leftover: income - totalService,
      ratioPercent: Math.round((totalService * 100) / income),
    };
  }, [income, commitments, amount, rate]);

  const money = (minorUnits: number) => format(fromMinorUnits(minorUnits, currency));
  const verdict = result === null ? null : verdictFor(result.ratioPercent);

  return (
    <Card>
      <CardBody className="grid gap-8 pt-6 lg:grid-cols-2">
        <div className="space-y-5">
          <CurrencyField value={currency} onChange={setCurrency} />
          <Field label="Net monthly income" required>
            <MoneyInput value={income} onChange={setIncome} currency={currency} required />
          </Field>
          <Field
            label="Existing monthly commitments"
            description="Rent or mortgage, other loan repayments, cards paid in full."
          >
            <MoneyInput value={commitments} onChange={setCommitments} currency={currency} />
          </Field>
          <Field label={`Loan amount, over ${DEFAULT_TERM_MONTHS} months`} required>
            <MoneyInput value={amount} onChange={setAmount} currency={currency} required />
          </Field>
          <Field label="Interest rate (%)">
            <Input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </Field>
        </div>

        <ResultPanel title="Would it fit?">
          {result === null || verdict === null ? (
            <p className="text-sm text-[var(--icb-text-muted)]">
              Enter your income, commitments and the loan to see whether the repayment fits.
            </p>
          ) : (
            <>
              <ResultRow label="New monthly payment" value={money(result.payment)} prominent />
              <ResultRow
                label="Share of income repaying debt"
                value={`${result.ratioPercent}%`}
              />
              <ResultRow label="Left each month after commitments" value={money(result.leftover)} />
              <p className={`pt-2 text-sm font-medium ${verdict.className}`}>
                {verdict.label}
                <span className="block font-normal text-[var(--icb-text-muted)]">
                  Under {COMFORTABLE_PERCENT}% of net income is comfortable; over{' '}
                  {STRETCHED_PERCENT}% leaves too little room for the unexpected.
                </span>
              </p>
            </>
          )}
        </ResultPanel>
      </CardBody>
    </Card>
  );
}
