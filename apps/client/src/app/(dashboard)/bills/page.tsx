import type { BillPayment, CursorPage, LinkedBill } from '@icb/contracts';
import { Amount, Card, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Receipt, Zap } from 'lucide-react';
import type { Metadata } from 'next';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Bills' };

/**
 * Bills and their payment history.
 *
 * Where a biller supports it, the outstanding balance and due date are fetched and shown — a
 * bill list that only records what you told it is an address book, not a bill payment feature.
 */
export default async function BillsPage() {
  const [bills, payments] = await Promise.all([
    api<{ items: LinkedBill[] }>('/bills', { tags: ['bills'] }),
    api<CursorPage<BillPayment>>('/bill-payments?limit=15', { tags: ['bills'] }),
  ]);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Bills</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Everything you pay regularly, with what is owed and when it is due.
        </p>
      </header>

      <section aria-labelledby="linked" className="mt-8">
        <h2 id="linked" className="font-display text-xl font-bold tracking-[-0.02em]">
          Your bills
        </h2>

        {bills.items.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {bills.items.map((bill) => (
              <Card key={bill.id}>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">
                      {bill.nickname ?? bill.billerName}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)] capitalize">
                      {bill.category.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--icb-text-subtle)]">
                      {bill.customerReference}
                    </p>
                  </div>
                  {bill.autopay?.enabled ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--icb-info-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--icb-info-fg)] ring-1 ring-[var(--icb-info-border)] ring-inset">
                      <Zap size={11} />
                      Autopay
                    </span>
                  ) : null}
                </div>

                {bill.outstandingBalance ? (
                  <div className="border-t border-[var(--icb-border)] px-5 py-3.5">
                    <p className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-[var(--icb-text-subtle)]">Outstanding</span>
                      <Amount value={bill.outstandingBalance} size="lg" />
                    </p>
                    {bill.dueOn ? (
                      <p className="mt-1 text-right text-xs text-[var(--icb-text-subtle)]">
                        Due {formatDate(bill.dueOn, 'medium')}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="border-t border-[var(--icb-border)] px-5 py-3.5">
                    <p className="text-xs text-[var(--icb-text-subtle)]">
                      {bill.lastPaidAt
                        ? `Last paid ${formatDate(bill.lastPaidAt, 'medium')}`
                        : 'No payments yet'}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <EmptyState
              icon={<Receipt size={20} />}
              title="No bills linked"
              description="Link a biller with your account reference and we will fetch the balance and due date where the biller supports it."
            />
          </Card>
        )}
      </section>

      <Card className="mt-10 overflow-hidden">
        <CardHeader title="Payment history" />
        {payments.items.length > 0 ? (
          <ul className="divide-y divide-[var(--icb-border)]">
            {payments.items.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{payment.billerName}</p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                    {payment.customerReference}
                    {payment.billerReference ? ` · ${payment.billerReference}` : ''}
                  </p>
                  {payment.failureReason ? (
                    <p className="mt-1 text-xs text-[var(--icb-danger-fg)]">
                      {payment.failureReason}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <Amount value={payment.amount} direction="debit" size="sm" />
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                    {formatDate(payment.paidAt ?? payment.createdAt, 'medium')}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Receipt size={20} />}
            title="No payments yet"
            description="Bill payments will appear here with the biller's own confirmation reference."
          />
        )}
      </Card>
    </>
  );
}
