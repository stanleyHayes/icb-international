import { Card, CardBody } from '@icb/ui';
import { MessageSquare, Phone, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const CHANNELS = [
  {
    icon: MessageSquare,
    title: 'Secure message',
    detail:
      'Message us from inside your account. The thread carries your account context, so you never have to explain who you are or repeat a reference.',
    action: 'Start a message',
    href: '/support/tickets/new',
  },
  {
    icon: Phone,
    title: 'Request a callback',
    detail:
      'We call you, so you never have to verify an inbound caller. Choose a window and we will ring within it.',
    action: 'Request a callback',
    href: '/support/callback',
  },
  {
    icon: ShieldAlert,
    title: 'Report fraud',
    detail:
      'Freeze the affected card first — it takes effect immediately — then tell us what happened. We assess provisional credit within 48 hours.',
    action: 'Freeze a card',
    href: '/cards',
  },
] as const;

/** The three ways to reach the bank, each card linking to where the action lives. */
export function ChannelCards() {
  return (
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
            <Link
              href={channel.href}
              className="mt-3 inline-block text-sm font-medium text-[var(--icb-primary)] hover:underline"
            >
              {channel.action}
            </Link>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
