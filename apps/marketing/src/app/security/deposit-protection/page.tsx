import { Card, CardBody } from '@icb/ui';
import { Check, X } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Deposit protection',
  description:
    'Eligible deposits at ICB are protected up to 250,000 per depositor. What is covered, what is not, and how quickly a payout would reach you.',
  path: '/security/deposit-protection',
});

const COVERED = [
  'Current account balances, in any of the fifteen supported currencies',
  'Savings balances, including savings goals and round-ups',
  'Fixed term deposits, including interest accrued to the date of failure',
  'Business current and deposit balances',
] as const;

const NOT_COVERED = [
  'Investment products — their value moves with the market and is a different kind of risk',
  'Money in transit between banks at the moment of failure, which remains the sending bank’s liability',
  'Balances above the 250,000 limit per depositor',
] as const;

export default function DepositProtectionPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Security centre', path: '/security' },
          { name: 'Deposit protection', path: '/security/deposit-protection' },
        ])}
      />
      <PageHeader
        eyebrow="Security centre"
        title="Deposit protection"
        standfirst="If a bank fails, deposit protection is what stands between you and the loss. Here is exactly what the protection covers at ICB, stated before you ever need it."
      />

      <Section title="The protection in one paragraph" tone="subtle">
        <Prose>
          <p>
            Eligible deposits at ICB are protected up to <strong>250,000 per depositor</strong>.
            The limit applies to the total across all your ICB accounts — current, savings and
            fixed deposits added together — not to each account separately. Joint accounts are
            protected per named holder, so a joint account held by two people is protected up to
            500,000 in total.
          </p>
          <p>
            You do not need to sign up, pay, or hold a minimum balance. Protection attaches to the
            deposit itself, from the day it is made.
          </p>
        </Prose>
      </Section>

      <Section title="What is and is not covered">
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardBody className="pt-6">
              <h3 className="text-base font-semibold">Covered</h3>
              <ul className="mt-4 space-y-3">
                {COVERED.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                    <Check
                      size={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[var(--icb-success-fg)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="pt-6">
              <h3 className="text-base font-semibold">Not covered</h3>
              <ul className="mt-4 space-y-3">
                {NOT_COVERED.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                    <X
                      size={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[var(--icb-danger-fg)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title="If the worst happened" tone="subtle">
        <Prose>
          <p>
            Payouts are made automatically — you would not need to apply. The scheme pays out
            within seven working days of a failure, to an account you hold elsewhere, using the
            contact details on your ICB profile. Keeping your phone number and address current is
            the one thing we ask.
          </p>
          <p>
            Temporary high balances — from a house sale, an inheritance or an insurance payout —
            are protected above the standard limit for six months from the date of deposit. If you
            expect such a balance, tell us and we will confirm the cover in writing.
          </p>
          <p>
            Protection is the backstop, not the plan. The plan is a ledger that reconciles to the
            cent every business day, capital held against the risks we actually run, and six
            invariants asserted continuously so that a problem is found by us before it is found
            by anyone else.
          </p>
        </Prose>
      </Section>
    </>
  );
}
