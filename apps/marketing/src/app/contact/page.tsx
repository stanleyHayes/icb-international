import { Card, CardBody } from '@icb/ui';
import { Clock, MessageSquareLock, Phone, PhoneCall } from 'lucide-react';
import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Contact us',
  description:
    'Every way to reach ICB: secure message in the app, a callback from us, and a 24-hour line for lost or stolen cards.',
  path: '/contact',
});

const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3101';

const CHANNELS = [
  {
    icon: MessageSquareLock,
    title: 'Secure message',
    body: 'The fastest route for almost everything. The thread sits inside your signed-in app, so we already know who you are and which account you mean — you never explain twice, and nothing sensitive crosses email.',
    detail: 'Replies within one business day',
  },
  {
    icon: PhoneCall,
    title: 'Request a callback',
    body: 'Ask us to call you from Support in the app. We call you, at a time you choose — so you never have to decide whether an inbound caller is really the bank.',
    detail: 'Weekdays 08:00–18:00, Saturdays 09:00–13:00',
  },
  {
    icon: Phone,
    title: 'Lost or stolen card',
    body: 'Freeze the card in the app first — that takes effect immediately. If you cannot reach the app, the card line is staffed around the clock.',
    detail: 'Open 24 hours, every day',
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Help centre', path: '/support' },
          { name: 'Contact us', path: '/contact' },
        ])}
      />
      <PageHeader
        eyebrow="Support"
        title="Contact us"
        standfirst="Three channels, each built so you never have to prove who you are twice — and none of which will ever ask for your password, PIN or a one-time code."
      />

      <Section title="Ways to reach us" tone="subtle">
        <div className="grid gap-5 md:grid-cols-3">
          {CHANNELS.map((channel) => (
            <Card key={channel.title} className="h-full">
              <CardBody className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
                  <channel.icon size={20} />
                </div>
                <h2 className="mt-4 text-base font-semibold">{channel.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {channel.body}
                </p>
                <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--icb-text-subtle)]">
                  <Clock size={13} aria-hidden="true" />
                  {channel.detail}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
        <p className="mt-8">
          <a
            href={`${CLIENT_URL}/login`}
            className="inline-flex h-10 items-center rounded-md bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
          >
            Sign in to message us
          </a>
        </p>
      </Section>

      <Section title="In writing">
        <Prose>
          <p>
            For anything that needs to be in writing — including complaints — write to{' '}
            <strong>ICB International Commercial Bank, 14 High Street, Accra</strong>. Written
            correspondence is logged on receipt and answered within the same deadlines as every
            other channel.
          </p>
          <p>
            A message found through a search engine, a social profile, or a text message is not
            us. If you are ever unsure whether a contact is genuine, sign in and use the secure
            thread — it cannot be spoofed, because it only exists inside your signed-in session.
          </p>
        </Prose>
      </Section>
    </>
  );
}
