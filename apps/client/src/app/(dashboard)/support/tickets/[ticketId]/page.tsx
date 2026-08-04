import type { SupportMessage, SupportTicket } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, cn, formatDate, formatTime } from '@icb/ui';
import { Paperclip } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ReplyForm } from '@/features/support/reply-form';
import { ApiError, api } from '@/lib/api';

export const metadata: Metadata = { title: 'Conversation' };

async function loadThread(ticketId: string): Promise<{
  ticket: SupportTicket;
  messages: SupportMessage[];
}> {
  try {
    const [ticket, messages] = await Promise.all([
      api<SupportTicket>(`/support/tickets/${ticketId}`, { tags: ['support'] }),
      api<SupportMessage[]>(`/support/tickets/${ticketId}/messages`, { tags: ['support'] }),
    ]);
    return { ticket, messages };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

/**
 * One conversation. Customer messages on one side, the bank on the other, system notes between
 * them — the chronology is the whole point, so nothing is collapsed or reordered.
 */
export default async function TicketThreadPage({
  params,
}: Readonly<{ params: Promise<{ ticketId: string }> }>) {
  const { ticketId } = await params;
  const { ticket, messages } = await loadThread(ticketId);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{ticket.subject}</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {ticket.reference} · opened {formatDate(ticket.createdAt, 'medium')}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </header>

      <ol aria-label="Message thread" className="mt-8 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ol>

      <Card className="mt-8">
        <CardHeader
          title={ticket.status === 'closed' ? 'This conversation is closed' : 'Reply'}
        />
        <CardBody className="pt-0">
          {ticket.status === 'closed' ? (
            <p className="text-sm text-[var(--icb-text-muted)]">
              Start a new message and mention {ticket.reference} if you need to pick this up again.
            </p>
          ) : (
            <ReplyForm ticketId={ticket.id} />
          )}
        </CardBody>
      </Card>
    </>
  );
}

function MessageBubble({ message }: Readonly<{ message: SupportMessage }>) {
  if (message.author === 'system') {
    return (
      <li className="text-center text-xs text-[var(--icb-text-subtle)]">
        {message.body} — {formatDate(message.sentAt, 'medium')} {formatTime(message.sentAt)}
      </li>
    );
  }
  const own = message.author === 'customer';
  return (
    <li className={cn('flex', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 sm:max-w-[70%]',
          own
            ? 'bg-[var(--icb-navy-700)] text-white'
            : 'border border-[var(--icb-border)] bg-[var(--icb-surface)]',
        )}
      >
        <p
          className={cn(
            'text-xs font-medium',
            own ? 'text-white/70' : 'text-[var(--icb-text-subtle)]',
          )}
        >
          {own ? 'You' : message.authorName} · {formatDate(message.sentAt, 'short')}{' '}
          {formatTime(message.sentAt)}
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{message.body}</p>
        {message.attachments.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {message.attachments.map((attachment) => (
              <li
                key={attachment.publicId}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  own ? 'text-white/80' : 'text-[var(--icb-text-muted)]',
                )}
              >
                <Paperclip size={12} aria-hidden="true" />
                {attachment.originalFilename ?? attachment.publicId}
                {attachment.bytes !== undefined
                  ? ` (${Math.max(1, Math.round(attachment.bytes / 1024))} KB)`
                  : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
