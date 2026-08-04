import { BASE_URL, SITE_NAME } from './metadata';

type JsonLdValue = Record<string, unknown>;

const SCHEMA_CONTEXT = 'https://schema.org';

export interface BreadcrumbEntry {
  readonly name: string;
  readonly path: string;
}

export interface FaqEntry {
  readonly q: string;
  readonly a: string;
}

export interface ProductEntry {
  readonly name: string;
  readonly description: string;
  readonly path: string;
}

export interface NewsArticleEntry {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly publishedAtIso: string;
}

/** Renders one JSON-LD block. `<` is escaped so the script can never break out of its tag. */
export function JsonLd({ data }: Readonly<{ data: JsonLdValue }>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export function breadcrumbJsonLd(items: readonly BreadcrumbEntry[]): JsonLdValue {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}

export function faqJsonLd(faqs: readonly FaqEntry[]): JsonLdValue {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };
}

/** The bank as a schema.org entity — referenced as `provider` by every product. */
export function organizationJsonLd(): JsonLdValue {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BankOrCreditUnion',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/icon.svg`,
    description:
      'Current accounts, savings, fixed deposits, cards, lending and international payments — built on a ledger that balances to the cent.',
  };
}

/** One FinancialProduct per offering, all provided by the bank entity above. */
export function financialProductsJsonLd(products: readonly ProductEntry[]): JsonLdValue {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'FinancialProduct',
        name: product.name,
        description: product.description,
        url: `${BASE_URL}${product.path}`,
        provider: { '@type': 'BankOrCreditUnion', name: SITE_NAME, url: BASE_URL },
      },
    })),
  };
}

export function newsArticleJsonLd(article: NewsArticleEntry): JsonLdValue {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAtIso,
    dateModified: article.publishedAtIso,
    mainEntityOfPage: `${BASE_URL}${article.path}`,
    publisher: {
      '@type': 'BankOrCreditUnion',
      name: SITE_NAME,
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/icon.svg`,
      },
    },
  };
}
