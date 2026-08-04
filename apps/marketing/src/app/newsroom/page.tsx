import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader, Section } from '@/components/page-header';
import { NEWS_ARTICLES } from '@/content/company';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Newsroom',
  description:
    'Announcements, product changes and policy decisions from ICB — with the reasoning attached, including where it is less flattering.',
  path: '/newsroom',
});

export default function NewsroomPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Newsroom', path: '/newsroom' },
        ])}
      />
      <PageHeader
        eyebrow="Company"
        title="Newsroom"
        standfirst="Product changes, rate decisions and policy updates, written by the people who made them. When a change is not in your favour, it is announced here too."
      />

      <Section>
        <ul className="max-w-3xl divide-y divide-[var(--icb-border)]">
          {NEWS_ARTICLES.map((article) => (
            <li key={article.slug} className="py-8 first:pt-0">
              <article>
                <p className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
                  {article.category}
                  <span className="mx-2 text-[var(--icb-text-subtle)]" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-normal tracking-normal text-[var(--icb-text-subtle)] normal-case">
                    {article.date}
                  </span>
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.02em]">
                  <Link
                    href={`/newsroom/${article.slug}`}
                    className="transition-colors hover:text-[var(--icb-primary)]"
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="mt-2 leading-relaxed text-[var(--icb-text-muted)]">
                  {article.standfirst}
                </p>
                <Link
                  href={`/newsroom/${article.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--icb-primary)] hover:underline"
                >
                  Read the announcement
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
