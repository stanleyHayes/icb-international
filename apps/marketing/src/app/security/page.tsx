import { Card, CardBody } from '@icb/ui';
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  Landmark,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Security centre',
  description:
    'How ICB protects your account: rotating sessions, step-up authentication, enforced card controls, and an immutable audit trail.',
  path: '/security',
});

const CONTROLS = [
  {
    icon: KeyRound,
    title: 'Sessions that rotate',
    body: 'Your refresh token is replaced every time it is used and stored only as a hash. If an old one is ever presented, every session in that family is revoked immediately — because the only way that happens is theft.',
  },
  {
    icon: Fingerprint,
    title: 'Step-up on what matters',
    body: 'Revealing a card number, adding a payee, moving a large sum or changing a security setting all require a fresh second factor. A stolen session is not enough.',
  },
  {
    icon: Lock,
    title: 'Card controls that decline',
    body: 'Freezing a card, blocking a category or capping a channel is enforced during authorisation, not merely recorded. A control you can see but that does not decline is worse than none.',
  },
  {
    icon: ShieldAlert,
    title: 'New payees cool off',
    body: 'A newly added payee is capped for four hours. This single control stops most authorised-push-payment fraud, where an attacker with your session adds their own account and empties the balance in one move.',
  },
  {
    icon: Siren,
    title: 'Scoring you can read',
    body: 'Every risk decision carries the rules that fired and what each contributed. If we hold a payment, you are told why in plain language, not given a reference number.',
  },
  {
    icon: ShieldCheck,
    title: 'An audit trail that cannot be edited',
    body: 'Every privileged action is appended to a hash-chained log. Altering a past entry breaks the chain, and the chain is verified nightly.',
  },
] as const;

const GUIDES = [
  {
    href: '/security/fraud-awareness',
    icon: ShieldAlert,
    title: 'Fraud awareness',
    body: 'The five scams that reach our customers most, the warning sign each carries, and exactly what to do in the first ten minutes.',
  },
  {
    href: '/security/deposit-protection',
    icon: Landmark,
    title: 'Deposit protection',
    body: 'What the 250,000-per-depositor protection covers, what it does not, and how quickly it pays out if the worst happens.',
  },
] as const;

export default function SecurityPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Security centre', path: '/security' },
        ])}
      />
      <PageHeader
        eyebrow="Security centre"
        title="What we do, and what we ask of you"
        standfirst="Security is mostly unglamorous engineering. Here is the specific work, rather than a promise to take it seriously."
      />

      <Section title="How your account is protected" tone="subtle">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((control) => (
            <Card key={control.title}>
              <CardBody className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
                  <control.icon size={20} />
                </div>
                <h3 className="mt-4 text-base font-semibold">{control.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {control.body}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="How we will and will not contact you">
        <Prose>
          <p>
            <strong>ICB will never</strong> ask for your password, your PIN, a one-time code, or
            the full number on your card. Not by phone, not by email, not by message. Anyone who
            does is not us, regardless of what the caller ID says.
          </p>
          <p>
            <strong>ICB will never</strong> ask you to move money to a &ldquo;safe account&rdquo;.
            There is no such thing. A request to do so is fraud, without exception.
          </p>
          <p>
            Emails from us come from a verified ICB domain and never carry an attachment you did
            not request. If a message asks you to act urgently, that urgency is the warning sign.
          </p>
          <h2>If something looks wrong</h2>
          <ul>
            <li>Freeze the affected card from the app — it takes effect immediately.</li>
            <li>Sign out of every device from Settings, then change your password.</li>
            <li>Raise a dispute on the transaction; provisional credit is assessed within 48 hours.</li>
            <li>Contact us through the app&rsquo;s secure message thread, never a number from a search result.</li>
          </ul>
          <h2>Deposit protection</h2>
          <p>
            Eligible deposits are protected up to 250,000 per depositor. Protection covers the
            total across all your ICB accounts, not each one separately.{' '}
            <Link
              href="/security/deposit-protection"
              className="font-medium text-[var(--icb-primary)] hover:underline"
            >
              How deposit protection works
            </Link>
            .
          </p>
        </Prose>
      </Section>

      <Section title="Guides" tone="subtle">
        <div className="grid gap-5 md:grid-cols-2">
          {GUIDES.map((guide) => (
            <Link key={guide.href} href={guide.href} className="group block">
              <Card className="h-full transition-shadow group-hover:shadow-[var(--shadow-md)]">
                <CardBody className="pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
                    <guide.icon size={20} />
                  </div>
                  <h3 className="mt-4 flex items-center gap-2 text-base font-semibold">
                    {guide.title}
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="text-[var(--icb-text-subtle)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                    {guide.body}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
