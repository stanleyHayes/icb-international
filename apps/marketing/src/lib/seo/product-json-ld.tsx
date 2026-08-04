import { breadcrumbJsonLd, faqJsonLd, financialProductsJsonLd, JsonLd } from './json-ld';

/**
 * The structured-data bundle for a product detail page: breadcrumb, the product itself as a
 * FinancialProduct offered by the bank, and the page's FAQs where it carries any.
 */
export function ProductJsonLd({
  name,
  description,
  path,
  categoryName,
  categoryPath,
  faqs,
}: Readonly<{
  name: string;
  description: string;
  path: string;
  categoryName: string;
  categoryPath: string;
  faqs: readonly { question: string; answer: string }[];
}>) {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: categoryName, path: categoryPath },
          { name, path },
        ])}
      />
      <JsonLd data={financialProductsJsonLd([{ name, description, path }])} />
      {faqs.length > 0 ? (
        <JsonLd data={faqJsonLd(faqs.map((faq) => ({ q: faq.question, a: faq.answer })))} />
      ) : null}
    </>
  );
}
