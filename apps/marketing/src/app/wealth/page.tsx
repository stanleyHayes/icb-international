import type { Metadata } from 'next';

import wealthPortrait from '@/assets/imagery/segment-wealth.webp';
import { PageHeader } from '@/components/page-header';
import { ProductSection } from '@/components/product-section';
import { WEALTH_PRODUCTS } from '@/content/products-wealth';
import { breadcrumbJsonLd, financialProductsJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Wealth',
  description:
    'Investment accounts, fifteen-currency FX and private banking from ICB — priced in the open, on the same ledger as your everyday banking.',
  path: '/wealth',
});

export default function WealthPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Wealth', path: '/wealth' },
        ])}
      />
      <JsonLd
        data={financialProductsJsonLd(
          WEALTH_PRODUCTS.map((product) => ({
            name: product.name,
            description: product.description,
            path: product.href,
          })),
        )}
      />
      <PageHeader
        eyebrow="Wealth"
        title="Money you keep, working as hard as money you spend"
        standfirst="Investments, foreign exchange and private banking on the same ledger as your current account — so a conversion, a trade and a transfer all post the same way: visibly, and to the cent."
        portrait={{
          src: wealthPortrait,
          alt: 'An ICB private banking client in his office in the late afternoon.',
        }}
      />
      {WEALTH_PRODUCTS.map((product, index) => (
        <ProductSection key={product.slug} product={product} reversed={index % 2 === 1} />
      ))}
    </>
  );
}
