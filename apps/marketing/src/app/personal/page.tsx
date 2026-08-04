import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { ProductSection } from '@/components/product-section';
import { PERSONAL_PRODUCTS } from '@/content/products';
import { breadcrumbJsonLd, financialProductsJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Personal banking',
  description:
    'Current accounts, savings, fixed deposits, cards and personal loans from ICB — every rate quoted with its basis.',
  path: '/personal',
});

export default function PersonalPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Personal banking', path: '/personal' },
        ])}
      />
      <JsonLd
        data={financialProductsJsonLd(
          PERSONAL_PRODUCTS.map((product) => ({
            name: product.name,
            description: product.description,
            path: product.href,
          })),
        )}
      />
      <PageHeader
        eyebrow="Personal"
        title="Everything you need, priced in the open"
        standfirst="Six products, each with its rate, its fees and its limits stated up front. Nothing is introductory, nothing reverts after six months."
      />
      {PERSONAL_PRODUCTS.map((product, index) => (
        <ProductSection key={product.slug} product={product} reversed={index % 2 === 1} />
      ))}
    </>
  );
}
