import { Amount, Card, CardBody } from '@icb/ui';

export interface CurrencyTotal {
  currency: string;
  minorUnits: number;
  accounts: number;
}

/** Net position per currency. A multi-currency customer needs these kept apart, never summed. */
export function CurrencyTotals({ totals }: Readonly<{ totals: CurrencyTotal[] }>) {
  return (
    <section aria-labelledby="position" className="mt-8">
      <h2 id="position" className="sr-only">
        Total position
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {totals.map((total) => (
          <Card key={total.currency}>
            <CardBody className="pt-5">
              <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                Total {total.currency}
              </p>
              <p className="mt-2">
                <Amount
                  value={{ minorUnits: total.minorUnits, currency: total.currency }}
                  size="xl"
                />
              </p>
              <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">
                across {total.accounts} account{total.accounts === 1 ? '' : 's'}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
