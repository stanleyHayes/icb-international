import type { AccountSummary } from '@icb/contracts';
import { Amount, Card, CardBody, StatusBadge, groupIdentifier, maskIdentifier } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Accounts' };

export default async function AccountsPage() {
  const { items } = await api<{ items: AccountSummary[] }>('/accounts', { tags: ['accounts'] });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Accounts</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {items.length} open account{items.length === 1 ? '' : 's'}
        </p>
      </header>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {items.map((account) => (
          <Card key={account.id} className="transition-shadow hover:shadow-[var(--shadow-md)]">
            <CardBody className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">
                    {account.nickname ?? account.productName}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                    {account.productName}
                  </p>
                </div>
                <StatusBadge status={account.status} />
              </div>

              <p className="mt-5">
                <Amount value={account.balances.ledger} size="xl" showCurrency />
              </p>
              <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
                Available <Amount value={account.balances.available} size="sm" />
              </p>

              <dl className="mt-5 space-y-1.5 border-t border-[var(--icb-border)] pt-4 font-mono text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Account</dt>
                  <dd>{account.identifiers.number}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">IBAN</dt>
                  <dd className="truncate">{groupIdentifier(account.identifiers.iban)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">SWIFT/BIC</dt>
                  <dd>{account.identifiers.bic}</dd>
                </div>
              </dl>

              <div className="mt-5 flex gap-2">
                <Link
                  href={`/transactions?account=${account.id}`}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
                >
                  Transactions
                </Link>
                <Link
                  href={`/transfer?from=${account.id}`}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
                >
                  Transfer
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs text-[var(--icb-text-subtle)]">
        Payments in are received using {maskIdentifier('sort code')} 60-16-13 and your account
        number above.
      </p>
    </>
  );
}
