import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { LEGAL_DOCUMENTS, type LegalDocument } from '@/content/legal';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

/** Builds the metadata for a legal page from its content entry. */
export function legalMetadata(slug: keyof typeof LEGAL_DOCUMENTS): Metadata {
  const doc = LEGAL_DOCUMENTS[slug];
  return pageMetadata({ title: doc.title, description: doc.standfirst, path: `/legal/${slug}` });
}

/**
 * Renders one legal document.
 *
 * The four documents are static routes rather than a dynamic segment: there will only ever be
 * four, they prerender, and static hrefs keep Next's typed-route table honest.
 */
export function LegalPage({ document }: Readonly<{ document: LegalDocument }>) {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Legal', path: '/legal/terms' },
          { name: document.title, path: `/legal/${document.slug}` },
        ])}
      />
      <PageHeader eyebrow="Legal" title={document.title} standfirst={document.standfirst}>
        <p className="text-sm text-[var(--icb-text-subtle)]">Last updated {document.updated}</p>
      </PageHeader>

      <Section>
        <Prose>
          {document.sections.map((section) => (
            <div key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-3">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </Prose>
      </Section>
    </>
  );
}
