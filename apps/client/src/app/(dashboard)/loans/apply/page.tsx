import type { AccountSummary, CursorPage, LoanProduct } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ApplicationWizard } from '@/features/loans/application-wizard';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Apply for a loan' };

type Search = Promise<{ product?: string }>;

/** The application wizard: product, price, declaration, review. */
export default async function ApplyPage({
  searchParams,
}: Readonly<{ searchParams: Search }>) {
  const { product } = await searchParams;
  const [products, accountsPage] = await Promise.all([
    api<{ items: LoanProduct[] }>('/loans/products', { tags: ['loans'], revalidate: 300 }),
    api<CursorPage<AccountSummary>>('/accounts?limit=50', { tags: ['accounts'] }),
  ]);
  const active = accountsPage.items.filter((account) => account.status === 'active');

  return (
    <>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Loans
      </Link>

      <div className="mt-6 max-w-[640px]">
        <Card>
          <CardHeader
            title="Apply for a loan"
            description="Check your rate first — it is indicative and costs nothing. The full decision runs only when you submit."
          />
          <CardBody className="pt-0">
            <ApplicationWizard
              products={products.items}
              accounts={active}
              initialProductCode={product}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
