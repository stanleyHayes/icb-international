import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { RateTable } from '@/components/rate-table';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Complaints',
  description:
    'How to complain to ICB, the deadlines we work to at every stage, and where to take it if our final response falls short.',
  path: '/complaints',
});

const DEADLINES = [
  ['Acknowledged', 'Within 3 business days', 'In writing, with a named case owner'],
  ['Progress update', 'At least every 2 weeks', 'Even if the update is that we are still working'],
  ['Final response', 'Within 8 weeks', 'With the reasoning and any redress, in plain language'],
] as const;

const STEPS = [
  {
    title: 'Tell us what happened',
    body: 'Raise it from Support in the app, by secure message, or in writing. Say what happened, when, and what would put it right. You will not need to repeat any of it later — the complaint keeps your account context.',
  },
  {
    title: 'A named owner takes the case',
    body: 'Within three business days you have a written acknowledgement and the name of the person who owns your complaint to its end. It is not passed around a queue.',
  },
  {
    title: 'We investigate and answer',
    body: 'The case owner pulls the ledger entries, the authorisation records and the messages — the same records you can see. You get a progress update at least every two weeks.',
  },
  {
    title: 'A final response, with reasons',
    body: 'Within eight weeks you receive a final response: what we found, the decision, any redress, and the reasons for all three. If we are wrong, we say so and put it right — a correction posts to the ledger as a new, visible transaction.',
  },
] as const;

export default function ComplaintsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Help centre', path: '/support' },
          { name: 'Complaints', path: '/complaints' },
        ])}
      />
      <PageHeader
        eyebrow="Support"
        title="Making a complaint"
        standfirst="A complaint is not a favour you ask of us; it is a process we owe you, with deadlines. Here is the process, the clock it runs on, and where to go if we fall short."
      />

      <Section title="The process" tone="subtle">
        <ol className="max-w-3xl space-y-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-5">
              <span
                aria-hidden="true"
                className="tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-navy-50)] text-sm font-semibold text-[var(--icb-primary)]"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="The deadlines we work to">
        <RateTable
          caption="Complaint handling deadlines"
          columns={['Stage', 'Deadline', 'What you receive']}
          rows={DEADLINES}
        />
        <p className="mt-6 max-w-2xl text-sm text-[var(--icb-text-muted)]">
          These are maximums, not targets. Most complaints are resolved well inside eight weeks,
          and you are never left waiting in silence — the two-week update is owed to you even when
          there is nothing new to say.
        </p>
      </Section>

      <Section title="If our final response falls short" tone="subtle">
        <Prose>
          <p>
            If you are not satisfied with the final response — or if eight weeks pass without one
            — you can take the complaint to the independent financial ombudsman, free of charge.
            The final response letter sets out exactly how, and taking a complaint further costs
            you nothing and changes nothing about how we treat your account.
          </p>
          <p>
            Complaints data — volumes, causes, and how long resolution actually took — is reviewed
            monthly by the executive and feeds directly into product changes. The four-hour cap on
            new payees began life as a pattern in complaints about account takeover.
          </p>
          <p>
            For anything that is not a complaint,{' '}
            <Link href="/contact" className="font-medium text-[var(--icb-primary)] hover:underline">
              contact us
            </Link>{' '}
            through the usual channels — you will reach a person faster.
          </p>
        </Prose>
      </Section>
    </>
  );
}
