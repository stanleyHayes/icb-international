import { Card, CardBody } from '@icb/ui';
import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader, Section } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Help & support',
  description: 'Answers to the questions ICB customers ask most, and how to reach a person.',
};

const FAQS = [
  {
    q: 'How long does a transfer take?',
    a: 'Between ICB accounts, instantly, at any hour. To another domestic bank, the next business day. A same-day wire arrives the same day if submitted before 16:00 UTC. International payments take two business days. Every transfer states its rail and expected arrival before you confirm.',
  },
  {
    q: 'What is the difference between my ledger and available balance?',
    a: 'Ledger balance is the sum of everything that has actually posted. Available balance is that figure minus any authorisation holds, plus any arranged overdraft. When you tap your card, a hold is placed immediately — the money is spoken for before the merchant has claimed it. Both numbers are shown so neither surprises you.',
  },
  {
    q: 'Why was my card declined when I have the money?',
    a: 'Most often a control you set: a frozen card, a blocked category, a disabled channel, or a per-transaction limit. Open the card in the app and the decline reason is on the authorisation. If no control was hit, the risk engine may have held it — in which case the rules that fired are shown to you.',
  },
  {
    q: 'I have added a new payee and cannot send the full amount.',
    a: 'New payees are capped for four hours after being added. This is deliberate: it is the single most effective control against someone who has gained access to your session adding their own account and draining the balance in one move. The cap lifts automatically.',
  },
  {
    q: 'How do I dispute a transaction?',
    a: 'Open the transaction and choose Dispute. Pick a reason, describe what happened and attach any evidence. We assess provisional credit within 48 hours and keep you updated at every stage. If the dispute is upheld the credit stands; if not, it is reversed and you are told why.',
  },
  {
    q: 'Can I get a statement for a period that is not a calendar month?',
    a: 'Yes. Documents lets you generate a statement for any date range. It is produced from the ledger itself, so the opening balance plus credits minus debits always equals the closing balance exactly.',
  },
  {
    q: 'What happens if I lose my card?',
    a: 'Freeze it in the app immediately — that takes effect at once, before you speak to anyone. Then report it lost or stolen in the same screen and choose whether to reissue. The old card is cancelled and any pending authorisations on it are released.',
  },
  {
    q: 'How is my money protected?',
    a: 'Eligible deposits are protected up to 250,000 per depositor across all your ICB accounts combined. Separately, your session token never reaches your browser, card numbers are encrypted at rest, and every privileged action is written to a hash-chained audit log.',
  },
] as const;

const CHANNELS = [
  { title: 'Secure message', detail: 'From Support in the app. Replies within one business day, and the thread keeps your account context.' },
  { title: 'Callback', detail: 'Request one from the app and we call you, so you never have to verify an inbound caller.' },
  { title: 'Complaints', detail: 'Raise through the app or in writing. We acknowledge within three business days and resolve within eight weeks.' },
] as const;

export default function SupportPage() {
  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Help, and how to reach a person"
        standfirst="The answers below cover most of what people ask. When they do not, the secure message thread in the app carries your account context so you never have to explain twice."
      />

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

      <Section title="Ways to reach us">
        <div className="grid gap-5 md:grid-cols-3">
          {CHANNELS.map((channel) => (
            <Card key={channel.title}>
              <CardBody className="pt-6">
                <h3 className="text-base font-semibold">{channel.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {channel.detail}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-sm text-[var(--icb-text-muted)]">
          We will never ask for your password, PIN, a one-time code, or your full card number.
          Anyone who does is not ICB. See the{' '}
          <a href="/security" className="font-medium text-[var(--icb-primary)] hover:underline">
            security centre
          </a>{' '}
          for what to do if you think something is wrong.
        </p>
      </Section>
    </>
  );
}
