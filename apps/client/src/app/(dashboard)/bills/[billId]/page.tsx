import type { AccountSummary, BillPayment, CursorPage, LinkedBill } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AutopayForm, UnlinkBillButton } from '@/features/bills/autopay-form';
import { DueBadge } from '@/features/bills/due-badge';
import { PayBillForm } from '@/features/bills/pay-bill-form';
import { api } from '@/lib/api';

type Params = Promise<{ billId: string }>;

export const metadata: Metadata = { title: 'Bill' };

/** One bill: what is owed, paying it, and the autopay that makes sure it never goes late. */
export default async function BillDetailPage({ params }: Readonly<{ params: Params }>) {
  const { billId } = await params;
  const [bill, accountsPage, payments] = await Promise.all([
    api<LinkedBill>(`/bills/${billId}`, { tags: ['bills'] }),
    api<CursorPage<AccountSummary>>('/accounts?limit=50', { tags: ['accounts'] }),
    api<CursorPage<BillPayment>>(`/bill-payments?billId=${billId}&limit=15`, { tags: ['bills'] }),
  ]);
  const active = accountsPage.items.filter((account) => account.status === 'active');

  return (
    <>
      <Link
        href="/bills"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All bills
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
            {bill.nickname ?? bill.billerName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {bill.billerName} · <span className="font-mono text-xs">{bill.customerReference}</span>
          </p>
        </div>
        {bill.dueOn ? <DueBadge dueOn={bill.dueOn} /> : null}
      </header>

      {bill.outstandingBalance ? (
        <Card className="mt-6">
          <CardBody className="flex flex-wrap items-baseline justify-between gap-4 py-5">
            <span className="text-sm text-[var(--icb-text-subtle)]">Outstanding balance</span>
            <Amount value={bill.outstandingBalance} size="xl" />
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pay this bill" description="Now, or scheduled for a date." />
          <CardBody className="pt-0">
            <PayBillForm bill={bill} accounts={active} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Autopay"
            description="Pay automatically before each due date, with a cap if you want one."
          />
          <CardBody className="pt-0">
            <AutopayForm bill={bill} accounts={active} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-8 overflow-hidden">
        <CardHeader title="Payments to this biller" />
        {payments.items.length > 0 ? (
          <ul className="divide-y divide-[var(--icb-border)]">
            {payments.items.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {formatDate(payment.paidAt ?? payment.createdAt, 'medium')}
                  </p>
                  {payment.billerReference ? (
                    <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                      {payment.billerReference}
                    </p>
                  ) : null}
                  {payment.failureReason ? (
                    <p className="mt-1 text-xs text-[var(--icb-danger-fg)]">
                      {payment.failureReason}
                    </p>
                  ) : null}
                </div>
                <Amount value={payment.amount} direction="debit" size="sm" />
                <StatusBadge status={payment.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Receipt size={20} />}
            title="No payments yet"
            description="Payments to this biller will appear here with the biller's confirmation reference."
          />
        )}
      </Card>

      <div className="mt-8">
        <UnlinkBillButton billId={bill.id} />
      </div>
    </>
  );
}
