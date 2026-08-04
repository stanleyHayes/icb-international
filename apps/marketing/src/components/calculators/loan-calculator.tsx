'use client';

import { format, fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Card, CardBody, Field, Input, MoneyInput, Slider } from '@icb/ui';
import { useMemo, useState } from 'react';

import { monthlyPaymentMinorUnits } from '@/lib/calculators';

import { CurrencyField, ResultPanel, ResultRow } from './calculator-parts';

const DEFAULT_RATE = '8.90';
const DEFAULT_TERM_MONTHS = 36;
const MIN_TERM_MONTHS = 6;
const MAX_TERM_MONTHS = 84;

/**
 * Loan calculator: what an amortising personal loan costs per month and overall.
 * Pure client-side — the maths runs in BigInt fixed point, so the payment shown here is the
 * payment the lending engine would quote for the same inputs.
 */
export function LoanCalculator() {
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [principal, setPrincipal] = useState<number | null>(1_500_000);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [termMonths, setTermMonths] = useState(DEFAULT_TERM_MONTHS);

  const result = useMemo(() => {
    if (principal === null || principal <= 0) {
      return null;
    }
    const payment = monthlyPaymentMinorUnits(principal, rate, termMonths);
    if (payment === null) {
      return null;
    }
    const total = payment * termMonths;
    return { payment, total, interest: total - principal };
  }, [principal, rate, termMonths]);

  const money = (minorUnits: number) => format(fromMinorUnits(minorUnits, currency));

  return (
    <Card>
      <CardBody className="grid gap-8 pt-6 lg:grid-cols-2">
        <div className="space-y-5">
          <CurrencyField value={currency} onChange={setCurrency} />
          <Field label="Loan amount" required>
            <MoneyInput value={principal} onChange={setPrincipal} currency={currency} required />
          </Field>
          <Field
            label="Interest rate (%)"
            description="Annual percentage rate (APR), fixed for the term."
          >
            <Input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </Field>
          <Field label={`Term — ${termMonths} months`}>
            <Slider
              value={termMonths}
              min={MIN_TERM_MONTHS}
              max={MAX_TERM_MONTHS}
              step={1}
              onChange={setTermMonths}
              formatValue={(value) => `${value} mo`}
            />
          </Field>
        </div>

        <ResultPanel title="Your repayment">
          {result === null ? (
            <p className="text-sm text-[var(--icb-text-muted)]">
              Enter an amount, a rate and a term to see the repayment.
            </p>
          ) : (
            <>
              <ResultRow label="Monthly payment" value={money(result.payment)} prominent />
              <ResultRow label={`Total repayable over ${termMonths} months`} value={money(result.total)} />
              <ResultRow label="Total interest" value={money(result.interest)} />
            </>
          )}
        </ResultPanel>
      </CardBody>
    </Card>
  );
}
