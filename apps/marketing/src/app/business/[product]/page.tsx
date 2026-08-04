import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductDetail } from '@/components/product-detail';
import { BUSINESS_PAGES } from '@/content/product-pages';
import { pageMetadata } from '@/lib/seo/metadata';
import { ProductJsonLd } from '@/lib/seo/product-json-ld';

/**
 * Business product detail pages (business current, merchant services, trade finance,
 * payroll, business loans). Fully static: params come from the content entries,
 * anything else is a 404.
 */
export const dynamicParams = false;

interface Params {
  readonly product: string;
}

function findProduct(product: string) {
  return BUSINESS_PAGES.find((page) => page.slug === product);
}

export function generateStaticParams(): Params[] {
  return BUSINESS_PAGES.map((page) => ({ product: page.slug }));
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
    path: `/business/${copy.slug}`,
  });
}

export default async function BusinessProductPage({
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
        path={`/business/${copy.slug}`}
        categoryName="Business banking"
        categoryPath="/business"
        faqs={copy.faqs}
      />
      <ProductDetail copy={copy} />
    </>
  );
}
