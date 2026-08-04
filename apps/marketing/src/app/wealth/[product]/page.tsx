import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductDetail } from '@/components/product-detail';
import { WEALTH_PAGES } from '@/content/product-pages';
import { pageMetadata } from '@/lib/seo/metadata';
import { ProductJsonLd } from '@/lib/seo/product-json-ld';

/**
 * Wealth product detail pages (investments, FX, private banking).
 * Fully static: params come from the content entries, anything else is a 404.
 */
export const dynamicParams = false;

interface Params {
  readonly product: string;
}

function findProduct(product: string) {
  return WEALTH_PAGES.find((page) => page.slug === product);
}

export function generateStaticParams(): Params[] {
  return WEALTH_PAGES.map((page) => ({ product: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const copy = findProduct((await params).product);
  if (!copy) return {};
  return pageMetadata({
    title: copy.name,
    description: copy.metaDescription,
    path: `/wealth/${copy.slug}`,
  });
}

export default async function WealthProductPage({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const copy = findProduct((await params).product);
  if (!copy) notFound();
  return (
    <>
      <ProductJsonLd
        name={copy.name}
        description={copy.metaDescription}
        path={`/wealth/${copy.slug}`}
        categoryName="Wealth"
        categoryPath="/wealth"
        faqs={copy.faqs}
      />
      <ProductDetail copy={copy} />
    </>
  );
}
