import { ArrowRight, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BalancePreview } from '@/components/balance-preview';
import { CallToActionSection } from '@/components/call-to-action-section';
import { CustomerBand } from '@/components/customer-band';
import { RateStrip } from '@/components/rate-strip';
import { TransparencySection } from '@/components/transparency-section';
import { WhyIcbSection } from '@/components/why-icb-section';
import { JsonLd, organizationJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Banking, exactly.',
    description:
      'Banking built on a real double-entry core. Current accounts, savings, cards, lending and international payments — with every posting traceable to the cent.',
    path: '/',
  }),
  title: { absolute: 'ICB — International Commercial Bank' },
};

const NUMBERS = [
  { value: '15', label: 'currencies held' },
  { value: '0.00', label: 'unexplained cents' },
  { value: '4.15%', label: 'on reserve savings' },
  { value: '24/7', label: 'ledger integrity checks' },
] as const;

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <section className="relative overflow-hidden border-b border-[var(--icb-border)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_15%_0%,var(--icb-navy-50),transparent_60%)]"
        />
        <div className="mx-auto grid max-w-[1200px] items-center gap-16 px-5 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <p className="inline-flex animate-rise items-center gap-2 rounded-full border border-[var(--icb-border)] bg-[var(--icb-surface)] px-3 py-1 text-xs font-medium text-[var(--icb-text-muted)]">
              <Lock size={12} className="text-[var(--icb-accent)]" />
              Deposits protected up to 250,000
            </p>

            <h1
              className="mt-6 animate-rise font-display text-5xl leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-[4.25rem]"
              style={{ animationDelay: '60ms' }}
            >
              Banking,
              <br />
              <span className="text-[var(--icb-primary)]">exactly.</span>
            </h1>

            <p
              className="mt-6 max-w-lg animate-rise text-lg leading-relaxed text-[var(--icb-text-muted)]"
              style={{ animationDelay: '120ms' }}
            >
              Current accounts, savings, cards, lending and international payments — built on a
              ledger that balances to the cent, every second of every day.
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

            <dl
              className="mt-14 grid animate-rise grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4"
              style={{ animationDelay: '240ms' }}
            >
              {NUMBERS.map((item) => (
                <div key={item.label}>
                  <dt className="sr-only">{item.label}</dt>
                  <dd className="tabular font-display text-2xl font-bold tracking-[-0.02em]">
                    {item.value}
                  </dd>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{item.label}</p>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-rise" style={{ animationDelay: '150ms' }}>
            <BalancePreview />
          </div>
        </div>
      </section>

      <RateStrip />

      <WhyIcbSection />

      <CustomerBand />

      <TransparencySection />

      <CallToActionSection />
    </>
  );
}
