import { Card, CardBody, Reveal } from '@icb/ui';
import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader, Section } from '@/components/page-header';
import { FAQS, HELP_ARTICLES, HELP_CATEGORIES } from '@/content/help';
import { breadcrumbJsonLd, faqJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

import { HelpSearch } from './help-search';

export const metadata: Metadata = pageMetadata({
  title: 'Help centre',
  description:
    'Search ICB help articles, browse by topic, read the frequently asked, and find every way to reach a person.',
  path: '/support',
});

const CHANNELS = [
  {
    title: 'Contact us',
    detail: 'Secure message, callback and urgent card help — every channel and its hours.',
    href: '/contact',
  },
  {
    title: 'Branches & cash machines',
    detail: 'Find a branch or cash machine, with opening hours and the services each offers.',
    href: '/support/branches',
  },
  {
    title: 'Make a complaint',
    detail: 'How to complain, the deadlines we work to, and where to go if we fall short.',
    href: '/complaints',
  },
] as const;

export default function SupportPage() {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQS)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Help centre', path: '/support' },
        ])}
      />

      <PageHeader
        eyebrow="Support"
        title="Help centre"
        standfirst="Search the articles below, browse by topic, or read the frequently asked. When none of it answers the question, a person is one secure message away."
      />

      <Section title="Search the help centre" tone="subtle">
        <HelpSearch articles={HELP_ARTICLES} />
      </Section>

      <Section title="Browse by topic">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HELP_CATEGORIES.map((category, index) => (
            <Reveal key={category.name} delay={(index % 4) * 60}>
              <Card>
                <CardBody className="pt-6">
                  <h3 className="text-base font-semibold">{category.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                    {category.description}
                  </p>
                  <p className="mt-3 text-xs text-[var(--icb-text-subtle)]">
                    {HELP_ARTICLES.filter((a) => a.category === category.name).length} articles
                  </p>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section title="Frequently asked" tone="subtle">
        <div className="max-w-3xl space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] px-5 py-4 [&[open]]:shadow-[var(--shadow-xs)]"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium">
                {faq.q}
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--icb-text-muted)]">{faq.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Still need a person?">
        <div className="grid gap-5 md:grid-cols-3">
          {CHANNELS.map((channel) => (
            <Link key={channel.href} href={channel.href} className="group block">
              <Card className="h-full transition-shadow group-hover:shadow-[var(--shadow-md)]">
                <CardBody className="pt-6">
                  <h3 className="text-base font-semibold group-hover:text-[var(--icb-primary)]">
                    {channel.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                    {channel.detail}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-sm text-[var(--icb-text-muted)]">
          We will never ask for your password, PIN, a one-time code, or your full card number.
          Anyone who does is not ICB. See the{' '}
          <Link href="/security" className="font-medium text-[var(--icb-primary)] hover:underline">
            security centre
          </Link>{' '}
          for what to do if you think something is wrong.
        </p>
      </Section>
    </>
  );
}
