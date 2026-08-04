import { Check } from 'lucide-react';
import type { Metadata } from 'next';

import { breadcrumbJsonLd, financialProductsJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

import { ApplicationFunnel } from './funnel';

export const metadata: Metadata = pageMetadata({
  title: 'Open an account',
  description:
    'Open an ICB current account in under ten minutes: choose your currency, verify your email, confirm your identity in the app.',
  path: '/open-account',
});

const STEPS = [
  { title: 'Your account', detail: 'Pick a currency and, if you like, add Reserve Savings.' },
  { title: 'Your details', detail: 'Name, email and mobile. Two minutes.' },
  { title: 'Verify & sign in', detail: 'A link by email, then a document and a selfie in the app.' },
  { title: 'Your account', detail: 'Number, IBAN and virtual card, issued the same day.' },
] as const;

const INCLUDED = [
  'A current account in the currency you choose',
  'A virtual card immediately, physical card by post',
  'Instant transfers to any other ICB customer',
  'Reserve Savings at 4.15% AER, opened in one tap',
  'Statements generated from the ledger, not a summary',
] as const;

export default function OpenAccountPage() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-16 lg:py-24">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Open an account', path: '/open-account' },
        ])}
      />
      <JsonLd
        data={financialProductsJsonLd([
          {
            name: 'Everyday Current',
            description:
              'A current account in any of fifteen currencies, with a debit card and instant transfers to other ICB customers.',
            path: '/open-account',
          },
        ])}
      />

      <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--icb-accent-text)] uppercase">
            Open an account
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            Ten minutes, start to finish
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--icb-text-muted)]">
            Apply now and verify your identity when you sign in. You can receive money straight
            away; sending unlocks once verification completes.
          </p>

          <ol className="mt-12 space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title + String(index)} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--icb-navy-700)] text-sm font-semibold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 border-t border-[var(--icb-border)] pt-8">
            <h2 className="text-xs font-semibold tracking-[0.12em] text-[var(--icb-text-subtle)] uppercase">
              What you get
            </h2>
            <ul className="mt-4 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--icb-success)]"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ApplicationFunnel />
      </div>
    </section>
  );
}
