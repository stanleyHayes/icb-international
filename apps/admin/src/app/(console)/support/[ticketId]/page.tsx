import type { StaffUser, SupportMessage } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AssignmentPanel } from '@/features/support/assignment-panel';
import { MacroPicker } from '@/features/support/macro-picker';
import { ReplyForm } from '@/features/support/reply-form';
import { SlaBadge } from '@/features/support/sla-badge';
import { TicketControls } from '@/features/support/ticket-controls';
import type {
  AssigneeOption,
  MacroView,
  SatisfactionView,
  StaffTicketDetail,
} from '@/features/support/types';
import { ApiError, api } from '@/lib/api';

export const metadata: Metadata = { title: 'Ticket' };

type Params = Promise<{ ticketId: string }>;

/**
 * One ticket, with the whole conversation and every action an agent can take on it.
 *
 * The thread leads: the reply an agent writes is only as good as what they have read, so the
 * conversation gets the main column and the controls sit to the side.
 */
export default async function TicketPage({ params }: Readonly<{ params: Params }>) {
  const { ticketId } = await params;
  const [detail, macros, assignees] = await Promise.all([
    api<StaffTicketDetail>(`/support/staff/tickets/${ticketId}`),
    api<MacroView[]>('/support/staff/macros'),
    fetchAssignees(),
  ]);

  const { ticket, messages } = detail;
  const open = ticket.status !== 'resolved' && ticket.status !== 'closed';

  return (
    <>
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Support inbox
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{ticket.subject}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={ticket.status} />
            <span className="capitalize">{ticket.priority} priority</span>
            <span className="font-mono text-xs">{ticket.reference}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--icb-text-subtle)]">First response due</p>
          <SlaBadge breached={ticket.slaBreached} dueAt={ticket.slaDueAt} />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="Conversation"
              description={`${messages.length} message${messages.length === 1 ? '' : 's'} · opened ${formatDate(ticket.createdAt, 'medium')}`}
            />
            <ul className="divide-y divide-[var(--icb-border)]">
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
            </ul>
          </Card>

          {open ? (
            <Card>
              <CardHeader title="Reply" description="Sent as a secure message, never by email." />
              <CardBody className="pt-0">
                <ReplyForm ticketId={ticket.id} />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Name</dt>
                  <dd>{ticket.customerName}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Category</dt>
                  <dd className="capitalize">{ticket.category.replaceAll('_', ' ')}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Assigned to</dt>
                  <dd>{ticket.assignedToName ?? 'Unassigned'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {ticket.satisfaction ? <CsatPanel satisfaction={ticket.satisfaction} /> : null}

          <Card>
            <CardHeader title="Assignment" />
            <CardBody className="pt-0">
              <AssignmentPanel ticketId={ticket.id} assignees={assignees} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Priority and status" />
            <CardBody className="pt-0">
              <TicketControls
                ticketId={ticket.id}
                priority={ticket.priority}
                status={ticket.status}
              />
            </CardBody>
          </Card>

          {open ? (
            <Card>
              <CardHeader title="Apply a macro" description="A reviewed reply, not a shortcut." />
              <CardBody className="pt-0">
                <MacroPicker ticketId={ticket.id} macros={macros} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function authorRole(message: SupportMessage): string {
  if (message.author === 'customer') return 'Customer';
  return message.author === 'agent' ? 'Support' : 'System';
}

function MessageItem({ message }: Readonly<{ message: SupportMessage }>) {
  return (
    <li className="px-5 py-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--icb-text-subtle)]">
        <span className="font-medium text-[var(--icb-text)]">
          {message.authorName}
          <span className="ml-2 font-normal text-[var(--icb-text-subtle)]">
            {authorRole(message)}
          </span>
        </span>
        <span>
          {formatDate(message.sentAt, 'medium')} {formatTime(message.sentAt)}
        </span>
      </p>
      <p className="mt-2 text-sm whitespace-pre-wrap">{message.body}</p>
    </li>
  );
}

/** The customer's own verdict on the handling — visible to the team, never editable. */
function CsatPanel({ satisfaction }: Readonly<{ satisfaction: SatisfactionView }>) {
  return (
    <Card>
      <CardHeader title="Customer rating" />
      <CardBody className="pt-0">
        <p
          className="flex items-center gap-1"
          aria-label={`Rated ${satisfaction.rating} out of 5`}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={16}
              aria-hidden="true"
              className={
                star <= satisfaction.rating
                  ? 'fill-[var(--icb-accent)] text-[var(--icb-accent-text)]'
                  : 'text-[var(--icb-border-strong)]'
              }
            />
          ))}
        </p>
        {satisfaction.comment ? (
          <p className="mt-2 text-sm text-[var(--icb-text-muted)]">{satisfaction.comment}</p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
          Rated {formatDate(satisfaction.ratedAt, 'medium')}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * The assignee picker's options.
 *
 * The staff directory is gated by the `staff:manage` permission, which a frontline support
 * agent does not hold — so a 403 narrows the picker to self-assignment and auto-assign rather
 * than taking the whole ticket page down with it.
 */
async function fetchAssignees(): Promise<AssigneeOption[]> {
  try {
    const staff = await api<StaffUser[]>('/admin/staff');
    return staff
      .filter((member) => member.active)
      .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` }));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      return [];
    }
    throw error;
  }
}
