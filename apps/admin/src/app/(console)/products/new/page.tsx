import { Card, CardBody, CardHeader } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductForm } from '@/features/products/product-form';

export const metadata: Metadata = { title: 'New product' };

export default function NewProductPage() {
  return (
    <>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Products
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">New product</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Created active. Fees and rate changes are scheduled from the product page afterwards.
        </p>
      </header>

      <Card className="mt-6">
        <CardHeader title="Catalogue entry" />
        <CardBody className="pt-0">
          <ProductForm />
        </CardBody>
      </Card>
    </>
  );
}
