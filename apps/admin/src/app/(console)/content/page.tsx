import type { RateTable } from '@icb/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';
import { FaqTab } from '@/features/content/faq-tab';
import { LocationsTab } from '@/features/content/locations-tab';
import { RatesTab } from '@/features/content/rates-tab';
import { TemplatesTab } from '@/features/content/templates-tab';
import {
  CONTENT_TABS,
  type ContentLocationView,
  type ContentTab,
  type FaqArticleView,
  type RateEntryView,
  type TemplateOverrideView,
} from '@/features/content/types';

export const metadata: Metadata = { title: 'Content' };

type SearchParams = Promise<{ tab?: string }>;

/**
 * The content console.
 *
 * Everything customers read that is not a product or a transaction: FAQ answers, the branch
 * and ATM locator, notification template overrides, and the published rate table. Each tab
 * fetches its own list; the rates tab also reads the public table back so staff edit against
 * what customers actually see.
 */
export default async function ContentPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const tab: ContentTab = CONTENT_TABS.some((candidate) => candidate.id === params.tab)
    ? (params.tab as ContentTab)
    : 'faq';

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Content</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Help centre, locator, notifications and published rates.
          </p>
        </div>
        <nav aria-label="Content sections" className="flex gap-2">
          {CONTENT_TABS.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/content?tab=${candidate.id}`}
              className={filterClass(tab === candidate.id)}
              aria-current={tab === candidate.id ? 'page' : undefined}
            >
              {candidate.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-6">
        {tab === 'faq' ? <FaqSection /> : null}
        {tab === 'locations' ? <LocationsSection /> : null}
        {tab === 'templates' ? <TemplatesSection /> : null}
        {tab === 'rates' ? <RatesSection /> : null}
      </div>
    </>
  );
}

async function FaqSection() {
  const articles = await api<FaqArticleView[]>('/admin/content/faq');
  return <FaqTab articles={articles} />;
}

async function LocationsSection() {
  const locations = await api<ContentLocationView[]>('/admin/content/locations');
  return <LocationsTab locations={locations} />;
}

async function TemplatesSection() {
  const templates = await api<TemplateOverrideView[]>('/admin/content/templates');
  return <TemplatesTab templates={templates} />;
}

async function RatesSection() {
  const [table, entries] = await Promise.all([
    api<RateTable>('/content/rates'),
    api<RateEntryView[]>('/admin/content/rates'),
  ]);
  return <RatesTab table={table} entries={entries} />;
}

function filterClass(active: boolean): string {
  return active
    ? 'inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white'
    : 'inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}
