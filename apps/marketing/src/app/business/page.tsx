import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { ProductSection } from '@/components/product-section';
import { BUSINESS_PRODUCTS } from '@/content/products';

export const metadata: Metadata = {
  title: 'Business banking',
  description:
    'Business current accounts, payments and collections, trade finance and lending from ICB.',
};

export default function BusinessPage() {
  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Banking that keeps up with your cash cycle"
        standfirst="Multi-currency accounts, bulk payments, four-eyes controls and trade finance — built for a finance team that needs to reconcile, not guess."
      />
      {BUSINESS_PRODUCTS.map((product, index) => (
        <ProductSection key={product.slug} product={product} reversed={index % 2 === 1} />
      ))}
    </>
  );
}
