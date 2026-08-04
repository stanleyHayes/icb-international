import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { NEWS_ARTICLES } from '@/content/company';
import { breadcrumbJsonLd, JsonLd, newsArticleJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

interface ArticleParams {
  readonly params: Promise<{ slug: string }>;
}

function findArticle(slug: string) {
  return NEWS_ARTICLES.find((article) => article.slug === slug);
}

function toIsoDate(displayDate: string): string | null {
  const value = new Date(`${displayDate} UTC`);
  if (Number.isNaN(value.getTime())) {
    return null;
  }
  return value.toISOString();
}

export function generateStaticParams() {
  return NEWS_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticleParams): Promise<Metadata> {
  const article = findArticle((await params).slug);
  if (!article) return {};
  const publishedAtIso = toIsoDate(article.date);
  return {
    ...pageMetadata({
      title: article.title,
      description: article.standfirst,
      path: `/newsroom/${article.slug}`,
    }),
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.standfirst,
      url: `/newsroom/${article.slug}`,
      siteName: 'ICB International Commercial Bank',
      ...(publishedAtIso ? { publishedTime: publishedAtIso, modifiedTime: publishedAtIso } : {}),
    },
  };
}

export default async function NewsArticlePage({ params }: ArticleParams) {
  const article = findArticle((await params).slug);
  if (!article) notFound();
  const publishedAtIso = toIsoDate(article.date);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Newsroom', path: '/newsroom' },
          { name: article.title, path: `/newsroom/${article.slug}` },
        ])}
      />
      {publishedAtIso ? (
        <JsonLd
          data={newsArticleJsonLd({
            title: article.title,
            description: article.standfirst,
            path: `/newsroom/${article.slug}`,
            publishedAtIso,
          })}
        />
      ) : null}
      <PageHeader eyebrow={`Newsroom · ${article.category}`} title={article.title}>
        <p className="text-sm text-[var(--icb-text-subtle)]">{article.date}</p>
      </PageHeader>

      <Section>
        <Prose>
          <p className="text-lg">
            <strong>{article.standfirst}</strong>
          </p>
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <p>
            <Link
              href="/newsroom"
              className="inline-flex items-center gap-1.5 font-medium text-[var(--icb-primary)] hover:underline"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              All announcements
            </Link>
          </p>
        </Prose>
      </Section>
    </>
  );
}
