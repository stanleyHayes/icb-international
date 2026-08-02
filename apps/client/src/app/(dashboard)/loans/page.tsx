import type { Loan, LoanApplication, LoanProduct } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Landmark } from 'lucide-react';
import type { Metadata } from 'next';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Loans' };

/**
 * Borrowing.
 *
 * An application in flight shows its decision factors, not just its status: a customer who is
 * declined is owed the reasoning, and one who is approved should be able to see what carried it.
 */
export default async function LoansPage() {
  const [loans, applications, products] = await Promise.all([
    api<{ items: Loan[] }>('/loans', { tags: ['loans'] }),
    api<{ items: LoanApplication[] }>('/loans/applications', { tags: ['loans'] }),
    api<{ items: LoanProduct[] }>('/loans/products', { tags: ['loans'], revalidate: 300 }),
  ]);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Loans</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          What you owe, what you have applied for, and what you could borrow.
        </p>
      </header>

      {loans.items.length > 0 ? (
        <section aria-labelledby="active" className="mt-8">
          <h2 id="active" className="font-display text-xl font-bold tracking-[-0.02em]">
            Your loans
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {loans.items.map((loan) => (
              <Card key={loan.id}>
                <CardBody className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{loan.productName}</h3>
                      <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                        {loan.reference}
                      </p>
                    </div>
                    <StatusBadge status={loan.arrears ? 'in_arrears' : loan.status} />
                  </div>

                  <p className="mt-4">
                    <Amount value={loan.totalOutstanding} size="xl" />
                    <span className="ml-2 text-sm text-[var(--icb-text-subtle)]">outstanding</span>
                  </p>

                  <dl className="mt-4 space-y-2 border-t border-[var(--icb-border)] pt-4 text-sm">
                    <Row label="Rate" value={`${loan.rate}%`} />
                    <Row
                      label="Instalment"
                      value={<Amount value={loan.instalment} size="sm" />}
                    />
                    <Row
                      label="Next payment"
                      value={
                        loan.nextPaymentOn ? formatDate(loan.nextPaymentOn, 'medium') : 'None due'
                      }
                    />
                    <Row
                      label="Remaining"
                      value={`${loan.remainingInstalments} of ${loan.paidInstalments + loan.remainingInstalments}`}
                    />
                  </dl>

                  {loan.arrears ? (
                    <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--icb-warning-border)] bg-[var(--icb-warning-bg)] px-3.5 py-2.5 text-xs text-[var(--icb-warning-fg)]">
                      <Amount value={loan.arrears.amount} size="sm" /> overdue by{' '}
                      {loan.arrears.daysPastDue} days. Bring the account up to date to avoid
                      further charges.
                    </p>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {applications.items.length > 0 ? (
        <section aria-labelledby="applications" className="mt-10">
          <h2 id="applications" className="font-display text-xl font-bold tracking-[-0.02em]">
            Applications
          </h2>
          <Card className="mt-4 overflow-hidden">
            <ul className="divide-y divide-[var(--icb-border)]">
              {applications.items.map((application) => (
                <li key={application.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{application.productName}</p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                        {application.reference} · {application.termMonths} months
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Amount value={application.requestedAmount} size="sm" />
                      <StatusBadge status={application.status} />
                    </div>
                  </div>

                  {application.decision ? (
                    <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--icb-bg-subtle)] px-4 py-3">
                      <p className="text-xs font-medium">
                        Score {application.decision.score} · {application.decision.band}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {application.decision.factors.slice(0, 4).map((factor) => (
                          <li
                            key={factor.code}
                            className="flex items-baseline justify-between gap-4 text-xs text-[var(--icb-text-muted)]"
                          >
                            <span>{factor.label}</span>
                            <span
                              className={
                                factor.contribution >= 0
                                  ? 'tabular text-[var(--icb-success-fg)]'
                                  : 'tabular text-[var(--icb-danger-fg)]'
                              }
                            >
                              {factor.contribution >= 0 ? '+' : ''}
                              {factor.contribution}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="products" className="mt-10">
        <h2 id="products" className="font-display text-xl font-bold tracking-[-0.02em]">
          What you could borrow
        </h2>

        {products.items.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.items.map((product) => (
              <Card key={product.code}>
                <CardBody className="pt-5">
                  <h3 className="text-base font-semibold">{product.name}</h3>
                  <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
                    {product.description}
                  </p>
                  <p className="tabular mt-4 font-display text-2xl font-bold tracking-[-0.02em]">
                    from {product.fromRate}%
                  </p>
                  <p className="text-xs text-[var(--icb-text-subtle)]">representative APR</p>
                  <p className="mt-3 text-xs text-[var(--icb-text-subtle)]">
                    <Amount value={product.minimumAmount} size="sm" /> to{' '}
                    <Amount value={product.maximumAmount} size="sm" /> over{' '}
                    {product.minimumTermMonths}–{product.maximumTermMonths} months
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <EmptyState
              icon={<Landmark size={20} />}
              title="No products available"
              description="Lending products will appear here once the catalogue is published."
            />
          </Card>
        )}
      </section>
    </>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
