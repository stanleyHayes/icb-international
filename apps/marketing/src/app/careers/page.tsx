import { Reveal } from '@icb/ui';
import { ChevronDown, MapPin } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { OPEN_ROLES } from '@/content/company';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Careers',
  description:
    'Open roles at ICB — engineering, risk, operations and design, in Accra, Kumasi and remote.',
  path: '/careers',
});

const WORKING_HERE = [
  {
    title: 'The bar is the ledger',
    body: 'A pull request that loses a fraction of a cent does not merge, however elegant it is. That standard sounds severe; in practice it means you are rarely woken by your own code.',
  },
  {
    title: 'Plain language is a deliverable',
    body: 'Every flow ships with the words a customer will read, reviewed with the same care as the code. If you cannot explain a decline to the person it declines, it is not finished.',
  },
  {
    title: 'Accessibility is a requirement',
    body: 'Keyboard-complete and screen-reader labelled is the definition of done, not a polish pass. You will learn more about inclusive design here in a year than most places manage in five.',
  },
] as const;

export default function CareersPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Careers', path: '/careers' },
        ])}
      />
      <PageHeader
        eyebrow="Company"
        title="Careers at ICB"
        standfirst="We are a small team building a bank where the ledger is the source of truth and the customer can see it. These are the roles we are hiring for now."
      />

      <Section title="Working here" tone="subtle">
        <div className="grid gap-5 md:grid-cols-3">
          {WORKING_HERE.map((item, index) => (
            <Reveal key={item.title} delay={index * 60}>
              <div>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        title={`Open roles (${OPEN_ROLES.length})`}
        description="Every role is listed with its team and location. If nothing fits but the work above sounds like yours, write to us anyway — the address is below."
      >
        <div className="max-w-3xl space-y-3">
          {OPEN_ROLES.map((role) => (
            <details
              key={role.id}
              className="group rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] px-5 py-4 [&[open]]:shadow-[var(--shadow-xs)]"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <span>
                  <span className="font-medium">{role.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-[var(--icb-text-subtle)]">
                    <MapPin size={13} aria-hidden="true" />
                    {role.team} · {role.location} · {role.type}
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                {role.summary}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <Section title="How to apply" tone="subtle">
        <Prose>
          <p>
            Write to <strong>careers@icb.bank</strong> with the role in the subject line. A
            short note on work you are proud of — with a link, a repository, or a document —
            carries more weight than a formatted CV. We reply to every application within five
            working days, including the ones we decline, and a declined application always comes
            with the reason.
          </p>
          <p>
            The process is a conversation, a piece of work done your way in your own time, and a
            final conversation. There is no whiteboard theatre and no unpaid week-long project.
          </p>
        </Prose>
      </Section>
    </>
  );
}
