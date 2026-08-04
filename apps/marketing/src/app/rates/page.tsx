import { formatDate } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { FeeSchedule } from '@/components/fee-schedule';
import { PageHeader, Section } from '@/components/page-header';
import { RateTable } from '@/components/rate-table';
import { getRatesView } from '@/lib/rates';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Rates & fees',
  description:
    'Every ICB rate and fee in one table, with the basis for each figure stated alongside it.',
  path: '/rates',
});

// Segment config is statically analyzed, so the interval must be a literal here rather than
// the imported RATES_REVALIDATE_SECONDS — the two must stay equal (both are hourly).
export const revalidate = 3600;

/**
 * The rates page.
 *
 * Figures come live from `GET /v1/products/rates` through hourly ISR; when the API is
 * unreachable at build time the same page ships with the seeded fallback table instead.
 * Every figure carries its basis — AER, fixed, representative APR, spread — because a page
 * of bare percentages is not disclosure, and this is the page a customer will quote back at us.
 */
export default async function RatesPage() {
  const view = await getRatesView();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Rates & fees', path: '/rates' },
        ])}
      />
      <PageHeader
        eyebrow="Rates &amp; fees"
        title="Every figure, and what it is measured against"
        standfirst="No introductory rates that revert, no fees that appear at the confirmation screen. If a charge is not on this page, we do not make it."
      >
        {view.live && view.effectiveFrom !== null ? (
          <p className="text-sm text-[var(--icb-text-muted)]">
            Rates effective from{' '}
            <time dateTime={view.effectiveFrom}>{formatDate(view.effectiveFrom, 'long')}</time>,
            reviewed continuously and republished here within the hour.
          </p>
        ) : null}
      </PageHeader>

      <Section title="Savings and credit interest" tone="subtle">
        <RateTable
          caption="Savings and credit interest rates"
          columns={['Product', 'Balance', 'Rate', 'Basis']}
          rows={view.savingsRows}
        />
      </Section>

      <Section
        title="Fixed term deposits"
        description="The rate is fixed for the whole term. Breaking early forfeits a share of accrued interest, quoted to the cent before you confirm."
      >
        <RateTable
          caption="Fixed term deposit rates"
          columns={['Term', 'Minimum', 'Rate (fixed)']}
          rows={view.depositRows}
        />
      </Section>

      <Section
        title="Borrowing"
        tone="subtle"
        description="The rate you are offered depends on the amount, the term and your circumstances. The range below is the whole range — there is no better rate behind a phone call."
      >
        <RateTable
          caption="Loan rates"
          columns={['Product', 'Rate', 'Basis']}
          rows={view.loanRows}
        />
      </Section>

      <Section
        title="How the headline rates compare"
        description="Saving and borrowing side by side, so the trade-off between access and return is visible in one place."
      >
        <RateTable
          caption="Headline rate comparison"
          columns={['Product', 'Rate', 'Basis', 'Access']}
          rows={view.comparisonRows}
        />
        <p className="mt-6 max-w-2xl text-sm text-[var(--icb-text-muted)]">
          Work out what a rate means in money with the{' '}
          <Link
            href="/tools"
            className="font-medium text-[var(--icb-primary)] underline underline-offset-4 hover:text-[var(--icb-primary-hover)]"
          >
            loan, savings and currency calculators
          </Link>
          .
        </p>
      </Section>

      <FeeSchedule />
    </>
  );
}
