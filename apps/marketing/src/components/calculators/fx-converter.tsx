'use client';

import { format, fromMinorUnits } from '@icb/money';
import { Card, CardBody, Field, Input, MoneyInput, Select } from '@icb/ui';
import { useMemo, useState } from 'react';

import { convertMinorUnits } from '@/lib/calculators';

import { ResultPanel, ResultRow } from './calculator-parts';

/**
 * Static major pairs with indicative mid rates. The rate is editable — a customer checking a
 * quote they were given elsewhere can type it in and see exactly what it means in money.
 * Live tradable quotes come from the API inside the banking app, with a countdown; this
 * converter is deliberately arithmetic only.
 */
const PAIRS = [
  { from: 'USD', to: 'EUR', rate: '0.9200' },
  { from: 'USD', to: 'GBP', rate: '0.7900' },
  { from: 'USD', to: 'GHS', rate: '14.8500' },
  { from: 'USD', to: 'NGN', rate: '1550.00' },
  { from: 'EUR', to: 'USD', rate: '1.0870' },
  { from: 'EUR', to: 'GBP', rate: '0.8585' },
  { from: 'GBP', to: 'USD', rate: '1.2658' },
  { from: 'GBP', to: 'GHS', rate: '18.7900' },
  { from: 'GHS', to: 'USD', rate: '0.0673' },
] as const;

type Pair = (typeof PAIRS)[number];

const DEFAULT_PAIR_INDEX = 0;

export function FxConverter() {
  const [pairIndex, setPairIndex] = useState(DEFAULT_PAIR_INDEX);
  const [amount, setAmount] = useState<number | null>(100_000);
  const [rate, setRate] = useState<string>(PAIRS[DEFAULT_PAIR_INDEX].rate);
  const pair: Pair = PAIRS[pairIndex] ?? PAIRS[DEFAULT_PAIR_INDEX];

  const converted = useMemo(
    () => (amount === null ? null : convertMinorUnits(amount, pair.from, pair.to, rate)),
    [amount, pair, rate],
  );

  const selectPair = (index: number) => {
    const next = PAIRS[index] ?? PAIRS[DEFAULT_PAIR_INDEX];
    setPairIndex(index);
    setRate(next.rate);
  };

  return (
    <Card>
      <CardBody className="grid gap-8 pt-6 lg:grid-cols-2">
        <div className="space-y-5">
          <Field label="Currency pair">
            <Select value={pairIndex} onChange={(event) => selectPair(Number(event.target.value))}>
              {PAIRS.map((option, index) => (
                <option key={`${option.from}/${option.to}`} value={index}>
                  {option.from} to {option.to}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Amount in ${pair.from}`} required>
            <MoneyInput value={amount} onChange={setAmount} currency={pair.from} required />
          </Field>
          <Field
            label={`Rate — ${pair.to} per 1 ${pair.from}`}
            description="Indicative mid rate. Edit it to check a quote you were given."
          >
            <Input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </Field>
        </div>

        <ResultPanel title="Converted amount">
          {converted === null || amount === null ? (
            <p className="text-sm text-[var(--icb-text-muted)]">
              Enter an amount and a rate to see the conversion.
            </p>
          ) : (
            <>
              <ResultRow
                label={`${format(fromMinorUnits(amount, pair.from))} converts to`}
                value={format(fromMinorUnits(converted, pair.to))}
                prominent
              />
              <ResultRow label="Rate used" value={`1 ${pair.from} = ${rate} ${pair.to}`} />
              <p className="pt-2 text-sm text-[var(--icb-text-muted)]">
                International transfers at ICB carry a 0.35% spread on the mid rate and no fixed
                fee — the quote you confirm in the app shows the spread separately.
              </p>
            </>
          )}
        </ResultPanel>
      </CardBody>
    </Card>
  );
}
