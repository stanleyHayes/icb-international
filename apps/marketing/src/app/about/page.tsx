import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'About ICB',
  description: 'ICB International Commercial Bank — how the bank is built and what it stands on.',
};

const FIGURES = [
  { value: '15', label: 'currencies held and settled' },
  { value: '0.00', label: 'unexplained cents, ever' },
  { value: '6', label: 'ledger invariants asserted continuously' },
  { value: '1', label: 'source of truth: the ledger' },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A bank is a ledger with a licence"
        standfirst="Everything else — the app, the card, the branch — is an interface onto that ledger. We built the ledger first."
      >
        <dl className="grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {FIGURES.map((figure) => (
            <div key={figure.label}>
              <dt className="sr-only">{figure.label}</dt>
              <dd className="tabular font-display text-3xl font-bold tracking-[-0.02em]">
                {figure.value}
              </dd>
              <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">{figure.label}</p>
            </div>
          ))}
        </dl>
      </PageHeader>

      <Section title="What we hold ourselves to" tone="subtle">
        <Prose>
          <p>
            <strong>Money is an integer.</strong> Every balance in ICB is held in whole minor
            units — cents, pesewas, pence. No floating point touches a figure that belongs to a
            customer, because floating point loses fractions and a bank that loses fractions is a
            bank that cannot be reconciled.
          </p>
          <p>
            <strong>Double entry or it did not happen.</strong> Every movement is two balanced
            postings. There is no balance column to overwrite and no code path that can change a
            balance without also recording where the value came from.
          </p>
          <p>
            <strong>Postings are immutable.</strong> Nothing is edited and nothing is deleted. A
            correction is a new, reversing transaction, and both remain on your statement. That is
            not an inconvenience — it is the only honest account of what happened.
          </p>
          <p>
            <strong>Every figure carries its basis.</strong> A rate without &ldquo;AER&rdquo; or
            &ldquo;representative APR&rdquo; beside it is decoration. We put the basis next to the
            number, including where the number is less flattering.
          </p>
          <p>
            <strong>Errors say what to do next.</strong> A declined payment tells you which limit
            was hit and by how much. A held transfer tells you which rule fired. A reference number
            with no explanation is not customer service.
          </p>
        </Prose>
      </Section>

      <Section title="How the bank is put together">
        <Prose>
          <p>
            The core is a double-entry ledger running on a MongoDB replica set, because
            multi-document ACID transactions are not optional when a single transfer writes a
            transaction header, its postings and its balance updates. Concurrent postings against
            one account retry rather than drop — the behaviour that matters most on payday.
          </p>
          <p>
            Six invariants are asserted on demand and at the end of every business day: every
            transaction balances per currency, the whole ledger nets to zero per currency, cached
            balances match what the entries compute, available balance never exceeds ledger
            balance, the suspense account is zero, and no account is negative without an agreed
            overdraft. If any one fails, we know before you do.
          </p>
          <p>
            Your session token never reaches your browser. The dashboard renders on the server and
            holds your credentials in an encrypted cookie only the server can open, so a script
            injected into the page has nothing to steal.
          </p>
        </Prose>
      </Section>
    </>
  );
}
