import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { ProductSection } from '@/components/product-section';
import { PERSONAL_PRODUCTS } from '@/content/products';

export const metadata: Metadata = {
  title: 'Personal banking',
  description:
    'Current accounts, savings, fixed deposits, cards and personal loans from ICB — every rate quoted with its basis.',
};

export default function PersonalPage() {
  return (
    <>
      <PageHeader
        eyebrow="Personal"
        title="Everything you need, priced in the open"
        standfirst="Five products, each with its rate, its fees and its limits stated up front. Nothing is introductory, nothing reverts after six months."
      />
      {PERSONAL_PRODUCTS.map((product, index) => (
        <ProductSection key={product.slug} product={product} reversed={index % 2 === 1} />
      ))}
    </>
  );
}
