import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { TicketForm } from '@/features/support/ticket-form';

export const metadata: Metadata = { title: 'New message' };

const VALID_CATEGORIES = new Set([
  'account',
  'card',
  'transfer',
  'loan',
  'technical',
  'complaint',
  'other',
]);

/**
 * Start a secure message. The `topic` query param lets other screens (for example the
 * close-account card in settings) pre-select a category without duplicating the form.
 */
export default async function NewTicketPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ topic?: string }> }>) {
  const { topic } = await searchParams;
  const defaultCategory = topic !== undefined && VALID_CATEGORIES.has(topic) ? topic : undefined;

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">New message</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          We reply inside your account — you will be notified when we do.
        </p>
      </header>

      <Card className="mt-8">
        <CardHeader
          title="Secure message"
          description="This thread is tied to your account, so we always know who we are talking to."
        />
        <CardBody className="pt-0">
          <TicketForm defaultCategory={defaultCategory} />
        </CardBody>
      </Card>
    </>
  );
}
