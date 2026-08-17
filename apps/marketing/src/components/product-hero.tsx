import { Card, CardBody } from '@icb/ui';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import type { ProductPageCopy } from '@/content/product-pages/types';

/**
 * The hero every product detail page opens with.
 *
 * Mirrors the home page's rhythm — eyebrow, display heading, lead, primary CTA — with the
 * product's headline figure and rate card on the right. The headline figure always carries
 * its basis underneath (brand/README.md §8).
 */
export function ProductHero({ copy }: Readonly<{ copy: ProductPageCopy }>) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--icb-border)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_15%_0%,var(--icb-navy-50),transparent_60%)]"
      />
      <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-xs font-medium text-[var(--icb-text-subtle)]">
              <li>
                <Link
                  href={copy.categoryHref}
                  className="transition-colors hover:text-[var(--icb-text)]"
                >
                  {copy.category}
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={12} />
              </li>
              <li aria-current="page" className="text-[var(--icb-accent-text)]">
                {copy.name}
              </li>
            </ol>
          </nav>
          <p className="mt-6 animate-rise text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
            {copy.tagline}
          </p>
          <h1
            className="mt-3 animate-rise font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl"
            style={{ animationDelay: '60ms' }}
          >
            {copy.name}
          </h1>
          <p
            className="mt-5 max-w-xl animate-rise text-lg leading-relaxed text-[var(--icb-text-muted)]"
            style={{ animationDelay: '120ms' }}
          >
            {copy.heroLead}
          </p>
          <div
            className="mt-9 flex animate-rise flex-wrap items-center gap-3"
            style={{ animationDelay: '180ms' }}
          >
            <Link
              href="/open-account"
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-6 text-base font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
            >
              Open an account
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/rates"
              className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-6 text-base font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
            >
              See rates &amp; fees
            </Link>
          </div>
        </div>
        <RatesCard copy={copy} />
      </div>
    </section>
  );
}

function RatesCard({ copy }: Readonly<{ copy: ProductPageCopy }>) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-brand-tile px-6 py-8 text-white">
        <p className="tabular font-display text-5xl font-bold tracking-[-0.03em]">
          {copy.headline}
        </p>
        <p className="mt-1.5 text-sm text-[var(--icb-navy-200)]">{copy.headlineNote}</p>
      </div>
      <CardBody className="pt-5">
        <h2 className="text-xs font-semibold tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
          Rates &amp; fees
        </h2>
        <dl className="mt-4 space-y-0">
          {copy.rates.map((rate) => (
            <div
              key={rate.label}
              className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] py-2.5 last:border-0"
            >
              <dt className="text-sm text-[var(--icb-text-muted)]">{rate.label}</dt>
              <dd className="tabular text-sm font-semibold">{rate.value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
