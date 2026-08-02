import { Card, CardBody, CardHeader } from '@icb/ui';
import { LifeBuoy, Lock, MessageSquare, Phone, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Support' };

const CHANNELS = [
  {
    icon: MessageSquare,
    title: 'Secure message',
    detail:
      'Message us from inside your account. The thread carries your account context, so you never have to explain who you are or repeat a reference.',
    action: 'Start a message',
  },
  {
    icon: Phone,
    title: 'Request a callback',
    detail:
      'We call you, so you never have to verify an inbound caller. Choose a window and we will ring within it.',
    action: 'Request a callback',
  },
  {
    icon: ShieldAlert,
    title: 'Report fraud',
    detail:
      'Freeze the affected card first — it takes effect immediately — then tell us what happened. We assess provisional credit within 48 hours.',
    action: 'Report fraud',
  },
] as const;

const IMMEDIATE = [
  {
    label: 'Review recent activity',
    href: '/transactions',
    detail: 'Every posting on every account, newest first',
  },
  {
    label: 'Check your balances',
    href: '/accounts',
    detail: 'Ledger, holds and available, side by side',
  },
  {
    label: 'Sign out everywhere',
    href: '/settings',
    detail: 'Ends every session on every device at once',
  },
] as const;

/**
 * Support.
 *
 * Leads with the actions a worried customer needs in the first thirty seconds — freeze, sign
 * out, review — before it offers a channel to talk to someone. Somebody who thinks they have
 * been defrauded needs a button, not a contact form.
 */
export default function SupportPage() {
  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Support</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Something wrong? Start here — the fastest fixes are one tap away.
        </p>
      </header>

      <Card className="mt-8">
        <CardHeader
          title="Act now"
          description="If you think your account is at risk, do these first. You can talk to us afterwards."
        />
        <ul className="divide-y divide-[var(--icb-border)]">
          {IMMEDIATE.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-subtle)]"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{item.detail}</p>
                </div>
                <span aria-hidden="true" className="text-[var(--icb-text-subtle)]">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="channels" className="mt-8">
        <h2 id="channels" className="font-display text-xl font-bold tracking-[-0.02em]">
          Talk to us
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {CHANNELS.map((channel) => (
            <Card key={channel.title}>
              <CardBody className="pt-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
                  <channel.icon size={18} />
                </div>
                <h3 className="mt-3.5 text-base font-semibold">{channel.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {channel.detail}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-8">
        <CardBody className="pt-5">
          <div className="flex items-start gap-3">
            <Lock
              size={18}
              className="mt-0.5 shrink-0 text-[var(--icb-accent)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">We will never ask for these</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                Your password, your PIN, a one-time code, or your full card number. Not by phone,
                not by email, not by message. Anyone who asks is not ICB, whatever the caller ID
                says. We will also never ask you to move money to a &ldquo;safe account&rdquo; —
                there is no such thing.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <p className="mt-8 flex items-center gap-2 text-sm text-[var(--icb-text-subtle)]">
        <LifeBuoy size={15} aria-hidden="true" />
        Complaints are acknowledged within three business days and resolved within eight weeks.
      </p>
    </>
  );
}
