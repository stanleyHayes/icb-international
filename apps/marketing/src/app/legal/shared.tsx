import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { LEGAL_DOCUMENTS, type LegalDocument } from '@/content/legal';

/** Builds the metadata for a legal page from its content entry. */
export function legalMetadata(slug: keyof typeof LEGAL_DOCUMENTS): Metadata {
  const doc = LEGAL_DOCUMENTS[slug];
  return { title: doc.title, description: doc.standfirst };
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
