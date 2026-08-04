'use client';

import type { AuditEvent } from '@icb/contracts';
import { Card, EmptyState, formatDate, formatTime } from '@icb/ui';
import { ChevronDown, ScrollText } from 'lucide-react';
import { useState } from 'react';

/**
 * The audit trail as an expandable table.
 *
 * Every row carries its full payload — the before/after changes, the hash link, the
 * correlation id — so the detail lives one click under the summary rather than on another
 * screen an operator has to find their way back from.
 */
export function AuditEventTable({ events }: Readonly<{ events: AuditEvent[] }>) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ScrollText size={20} />}
          title="No events match"
          description="Loosen the filters, or widen the date range."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Audit events, newest first</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">Seq</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Actor</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Subject</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Summary</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">At</th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                <span className="sr-only">Expand</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {events.map((event) => (
              <AuditEventRow
                key={event.id}
                event={event}
                open={openId === event.id}
                onToggle={() => setOpenId(openId === event.id ? null : event.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AuditEventRow({
  event,
  open,
  onToggle,
}: Readonly<{ event: AuditEvent; open: boolean; onToggle: () => void }>) {
  const detailId = `audit-event-${event.id}`;

  return (
    <>
      <tr className="hover:bg-[var(--icb-bg-subtle)]">
        <td className="tabular px-5 py-3 font-mono text-xs text-[var(--icb-text-subtle)]">
          {event.sequence}
        </td>
        <td className="px-3 py-3">
          <span className="text-sm">{event.actorLabel}</span>
          <span className="block text-xs text-[var(--icb-text-subtle)] capitalize">
            {event.actorType}
          </span>
        </td>
        <td className="px-3 py-3 font-mono text-xs">{event.action}</td>
        <td className="px-3 py-3 text-xs">
          {event.subjectType}
          {event.subjectId ? (
            <span className="block max-w-[140px] truncate font-mono text-[var(--icb-text-subtle)]">
              {event.subjectId}
            </span>
          ) : null}
        </td>
        <td className="max-w-[280px] px-3 py-3 text-xs text-[var(--icb-text-muted)]">
          <span className="line-clamp-2">{event.summary}</span>
        </td>
        <td className="px-3 py-3 text-right text-xs whitespace-nowrap text-[var(--icb-text-subtle)]">
          {formatDate(event.at, 'short')} {formatTime(event.at)}
        </td>
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={open ? 'Hide event detail' : 'Show event detail'}
            className="rounded-md p-1.5 text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
          >
            <ChevronDown size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </td>
      </tr>
      {open ? (
        <tr id={detailId}>
          <td colSpan={7} className="bg-[var(--icb-bg-subtle)] px-5 py-4">
            <AuditEventDetail event={event} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** The full record: what changed, and the hash-chain links that make tampering detectable. */
function AuditEventDetail({ event }: Readonly<{ event: AuditEvent }>) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p className="text-xs font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
          Changes
        </p>
        {event.changes.length > 0 ? (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--icb-text-subtle)]">
                <th scope="col" className="py-1 pr-3 font-medium">Field</th>
                <th scope="col" className="py-1 pr-3 font-medium">Before</th>
                <th scope="col" className="py-1 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {event.changes.map((change) => (
                <tr key={change.field} className="border-t border-[var(--icb-border)]">
                  <td className="py-1.5 pr-3 font-medium">{change.field}</td>
                  <td className="max-w-[180px] py-1.5 pr-3 break-words text-[var(--icb-danger-fg)]">
                    {change.before || '—'}
                  </td>
                  <td className="max-w-[180px] py-1.5 break-words text-[var(--icb-success-fg)]">
                    {change.after || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
            No field-level changes recorded for this event.
          </p>
        )}
      </div>

      <dl className="space-y-2 text-xs">
        <Detail label="Event id" value={event.id} />
        <Detail label="Correlation id" value={event.correlationId} />
        <Detail label="IP address" value={event.ipAddress ?? '—'} />
        <Detail label="Hash" value={event.hash} />
        <Detail label="Previous hash" value={event.previousHash ?? 'Genesis event'} />
      </dl>
    </div>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="min-w-0 flex-1 break-all font-mono">{value}</dd>
    </div>
  );
}
