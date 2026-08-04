import { Card, CardBody } from '@icb/ui';
import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

import type { ProductCopy } from '@/content/products';

/**
 * One product, rendered from `content/products.ts`.
 *
 * The headline figure always carries its basis underneath — a rate without "AER" or
 * "representative APR" beside it is decoration, not information (brand/README.md §8).
 */
export function ProductSection({
  product,
  reversed,
}: Readonly<{ product: ProductCopy; reversed: boolean }>) {
  return (
    <section
      id={product.slug}
      className={
        reversed
          ? 'scroll-mt-20 border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)]'
          : 'scroll-mt-20 border-b border-[var(--icb-border)]'
      }
    >
      <div className="mx-auto max-w-[1200px] px-5 py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className={reversed ? 'lg:order-2' : ''}>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
              {product.tagline}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.02em]">
              {product.name}
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--icb-text-muted)]">
              {product.description}
            </p>

            <ul className="mt-7 space-y-3">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <Check
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--icb-success)]"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/open-account"
                className="inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
              >
                Open an account
              </Link>
              <Link
                href={product.href}
                className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
              >
                Learn more
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className={reversed ? 'lg:order-1' : ''}>
            <Card className="overflow-hidden">
              <div className="bg-brand-tile px-6 py-8 text-white">
                <p className="tabular font-display text-5xl font-bold tracking-[-0.03em]">
                  {product.headline}
                </p>
                <p className="mt-1.5 text-sm text-[var(--icb-navy-200)]">{product.headlineNote}</p>
              </div>
              <CardBody className="pt-5">
                <h3 className="text-xs font-semibold tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                  Rates &amp; fees
                </h3>
                <dl className="mt-4 space-y-0">
                  {product.fees.map((fee) => (
                    <div
                      key={fee.label}
                      className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] py-2.5 last:border-0"
                    >
                      <dt className="text-sm text-[var(--icb-text-muted)]">{fee.label}</dt>
                      <dd className="tabular text-sm font-semibold">{fee.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
