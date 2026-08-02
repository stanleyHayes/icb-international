import type { AccountSummary, MoneyDto } from '@icb/contracts';
import { Card, maskIdentifier } from '@icb/ui';
import { ArrowRight } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

/**
 * The customer's main account, rendered as the hero of the overview.
 *
 * Shows ledger *and* available balance, plus any holds — a customer who sees only one number is
 * the customer who gets declined at a till.
 */
export function PrimaryAccountCard({ account }: Readonly<{ account: AccountSummary }>) {
  return (
    <section aria-labelledby="primary-account" className="mt-8">
      <h2 id="primary-account" className="sr-only">
        Primary account
      </h2>
      <Card className="overflow-hidden">
        <div className="bg-brand-tile px-6 py-7 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--icb-navy-200)] uppercase">
                {account.nickname ?? account.productName}
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--icb-navy-200)]">
                {maskIdentifier(account.identifiers.number)} · {account.currency}
              </p>
              <p className="tabular mt-6 font-display text-4xl font-bold tracking-[-0.02em]">
                {formatBalance(account.balances.ledger)}
              </p>
              <p className="mt-1.5 text-sm text-[var(--icb-navy-200)]">
                Available {formatBalance(account.balances.available)}
                {account.balances.holds.minorUnits > 0
                  ? ` · ${formatBalance(account.balances.holds)} on hold`
                  : ''}
              </p>
            </div>
            <Link
              href={`/accounts/${account.id}` as Route}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-white/10 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              View account
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}

function formatBalance(money: MoneyDto): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
  }).format(money.minorUnits / 10 ** money.scale);
}
