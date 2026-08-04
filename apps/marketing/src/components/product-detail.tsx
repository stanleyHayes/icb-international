import { CallToActionSection } from '@/components/call-to-action-section';
import { ProductHero } from '@/components/product-hero';
import { EligibilitySection, FaqSection, FeatureGrid } from '@/components/product-sections';
import type { ProductPageCopy } from '@/content/product-pages/types';
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo/json-ld';
import { BASE_URL, SITE_NAME } from '@/lib/seo/metadata';

/**
 * A full product detail page, rendered from one content entry.
 *
 * Hero → features → eligibility → FAQ → CTA, with JSON-LD (`FinancialProduct`,
 * `BreadcrumbList`, `FAQPage`) emitted via the shared SEO builders. All sections are
 * server-rendered, so the page is static by construction.
 */
export function ProductDetail({ copy }: Readonly<{ copy: ProductPageCopy }>) {
  const path = `${copy.categoryHref}/${copy.slug}`;
  return (
    <>
      <ProductHero copy={copy} />
      <FeatureGrid features={copy.features} />
      <EligibilitySection copy={copy} />
      <FaqSection faqs={copy.faqs} />
      <CallToActionSection />
      <JsonLd data={financialProductJsonLd(copy, path)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: copy.category, path: copy.categoryHref },
          { name: copy.name, path },
        ])}
      />
      <JsonLd data={faqJsonLd(copy.faqs.map((faq) => ({ q: faq.question, a: faq.answer })))} />
    </>
  );
}

function financialProductJsonLd(
  copy: ProductPageCopy,
  path: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: `${copy.name} — ICB ${copy.category}`,
    description: copy.metaDescription,
    url: `${BASE_URL}${path}`,
    provider: { '@type': 'BankOrCreditUnion', name: SITE_NAME, url: BASE_URL },
  };
}
