import type { Biller, CursorPage } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BillerBrowser } from '@/features/bills/biller-browser';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Add a bill' };

/** Browse the biller directory and link one with the reference off the customer's own bill. */
export default async function NewBillPage() {
  const { items } = await api<CursorPage<Biller>>('/billers?limit=100', {
    tags: ['billers'],
    revalidate: 300,
  });
  const active = items.filter((biller) => biller.active);

  return (
    <>
      <Link
        href="/bills"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All bills
      </Link>

      <div className="mt-6 max-w-[640px]">
        <Card>
          <CardHeader
            title="Add a bill"
            description="Find the biller, then enter the reference from your bill. Where the biller supports it, we fetch what you owe and when it is due."
          />
          <CardBody className="pt-0">
            <BillerBrowser billers={active} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
