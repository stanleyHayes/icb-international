import type { Metadata } from 'next';

import businessPortrait from '@/assets/imagery/segment-business.webp';
import { PageHeader } from '@/components/page-header';
import { ProductSection } from '@/components/product-section';
import { BUSINESS_PRODUCTS } from '@/content/products-business';
import { breadcrumbJsonLd, financialProductsJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Business banking',
  description:
    'Business current accounts, payments and collections, trade finance and lending from ICB.',
  path: '/business',
});

export default function BusinessPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Business banking', path: '/business' },
        ])}
      />
      <JsonLd
        data={financialProductsJsonLd(
          BUSINESS_PRODUCTS.map((product) => ({
            name: product.name,
            description: product.description,
            path: product.href,
          })),
        )}
      />
      <PageHeader
        eyebrow="Business"
        title="Banking that keeps up with your cash cycle"
        standfirst="Multi-currency accounts, bulk payments, four-eyes controls and trade finance — built for a finance team that needs to reconcile, not guess."
        portrait={{
          src: businessPortrait,
          alt: 'A textile business owner in her Accra workshop, an ICB business banking customer.',
        }}
      />
      {BUSINESS_PRODUCTS.map((product, index) => (
        <ProductSection key={product.slug} product={product} reversed={index % 2 === 1} />
      ))}
    </>
  );
}
