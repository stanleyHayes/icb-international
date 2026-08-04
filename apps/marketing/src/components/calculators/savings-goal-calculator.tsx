'use client';

import { format, fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Card, CardBody, Field, Input, MoneyInput } from '@icb/ui';
import { useMemo, useState } from 'react';

import { monthsToSavingsGoal } from '@/lib/calculators';

import { CurrencyField, formatMonths, ResultPanel, ResultRow } from './calculator-parts';

const DEFAULT_RATE = '4.15';

function goalVerdict(months: number, reached: boolean): string {
  if (months === 0) {
    return 'You have already reached this goal.';
  }
  if (!reached) {
    return 'Not within a hundred years at this rate — raise the monthly amount or the target date.';
  }
  return `You will reach the goal in ${formatMonths(months)}.`;
}

/**
 * Savings-goal calculator: how long a goal takes at a given monthly contribution and rate.
 * Interest compounds monthly, contributions land after interest, all in fixed point.
 */
export function SavingsGoalCalculator() {
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [goal, setGoal] = useState<number | null>(2_000_000);
  const [current, setCurrent] = useState<number | null>(250_000);
  const [monthly, setMonthly] = useState<number | null>(40_000);
  const [rate, setRate] = useState(DEFAULT_RATE);

  const result = useMemo(() => {
    if (goal === null || goal <= 0 || current === null || monthly === null) {
      return null;
    }
    return monthsToSavingsGoal({
      goalMinor: goal,
      currentMinor: current,
      monthlyMinor: monthly,
      annualRateText: rate,
    });
  }, [goal, current, monthly, rate]);

  const money = (minorUnits: number) => format(fromMinorUnits(minorUnits, currency));

  return (
    <Card>
      <CardBody className="grid gap-8 pt-6 lg:grid-cols-2">
        <div className="space-y-5">
          <CurrencyField value={currency} onChange={setCurrency} />
          <Field label="Savings goal" required>
            <MoneyInput value={goal} onChange={setGoal} currency={currency} required />
          </Field>
          <Field label="Saved so far">
            <MoneyInput value={current} onChange={setCurrent} currency={currency} />
          </Field>
          <Field label="Monthly contribution" required>
            <MoneyInput value={monthly} onChange={setMonthly} currency={currency} required />
          </Field>
          <Field label="Interest rate (%)" description="AER on the account the goal lives in.">
            <Input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </Field>
        </div>

        <ResultPanel title="Your plan">
          {result === null ? (
            <p className="text-sm text-[var(--icb-text-muted)]">
              Enter a goal, a monthly contribution and a rate to see how long it takes.
            </p>
          ) : (
            <>
              <ResultRow
                label="Time to goal"
                value={result.reached ? formatMonths(result.months) : 'Over 100 years'}
                prominent
              />
              <ResultRow label="Goal" value={money(goal ?? 0)} />
              <ResultRow label="Monthly contribution" value={money(monthly ?? 0)} />
              <p className="pt-2 text-sm text-[var(--icb-text-muted)]">
                {goalVerdict(result.months, result.reached)}
              </p>
            </>
          )}
        </ResultPanel>
      </CardBody>
    </Card>
  );
}
