'use client';

import type { Hold } from '@icb/contracts';
import { Amount, Button, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { LockOpen } from 'lucide-react';
import { useState } from 'react';

import { forceExpireHold } from '@/features/accounts/actions';
import { OpMessage, useOpForm } from '@/features/accounts/use-op-form';

function holdStatus(hold: Hold): { label: string; active: boolean } {
  if (hold.releasedAt !== null) return { label: 'released', active: false };
  if (new Date(hold.expiresAt).getTime() <= Date.now()) return { label: 'expired', active: false };
  return { label: 'active', active: true };
}

/** Inline reason + confirm for releasing one hold before its natural expiry. */
function ExpireControl({ accountId, holdId }: Readonly<{ accountId: string; holdId: string }>) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const form = useOpForm(forceExpireHold);

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Force expire
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`expire-reason-${holdId}`}>
        Reason for releasing this hold
      </label>
      <input
        id={`expire-reason-${holdId}`}
        className="h-8 w-56 rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-2 text-sm"
        placeholder="Reason (required)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={form.pending || reason.trim().length < 4}
          onClick={() => form.submit({ accountId, holdId, reason })}
        >
          {form.pending ? 'Releasing…' : 'Confirm release'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <OpMessage done={form.done} message={form.message} />
    </div>
  );
}

/**
 * Reservations against the account's available balance. Active holds can be force-expired —
 * with a mandatory reason, because releasing committed money is exactly the kind of action the
 * audit trail exists for.
 */
export function HoldsTable({
  accountId,
  holds,
}: Readonly<{ accountId: string; holds: Hold[] }>) {
  if (holds.length === 0) {
    return (
      <EmptyState
        icon={<LockOpen size={20} />}
        title="No holds"
        description="There are no reservations against this account's balance."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Holds on this account</caption>
        <thead>
          <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-5 py-2.5 font-medium">Reason</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Amount</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Placed</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Expires</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {holds.map((hold) => {
            const status = holdStatus(hold);
            return (
              <tr key={hold.id} className="align-top hover:bg-[var(--icb-bg-subtle)]">
                <td className="px-5 py-3">
                  <p className="font-medium">{hold.reason}</p>
                  <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                    {hold.sourceReference ?? hold.id.slice(0, 10)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Amount value={hold.amount} size="sm" />
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">
                  {formatDate(hold.placedAt, 'medium')}
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">
                  {formatDate(hold.expiresAt, 'medium')}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={status.label} />
                </td>
                <td className="px-5 py-3 text-right">
                  {status.active ? <ExpireControl accountId={accountId} holdId={hold.id} /> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
