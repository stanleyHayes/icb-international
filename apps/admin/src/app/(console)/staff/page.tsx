import type { StaffUser } from '@icb/contracts';
import { Card, EmptyState, formatDate, StatusBadge } from '@icb/ui';
import { KeyRound, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AccessDenied } from '@/components/access-denied';
import { api } from '@/lib/api';
import { isForbidden } from '@/lib/guards';

export const metadata: Metadata = { title: 'Staff' };

/**
 * The staff directory.
 *
 * Who can operate the console, with what roles, and whether their second factor is on — the
 * three facts an administrator scans for. Provisioning and per-person changes happen on the
 * detail and new pages.
 */
export default async function StaffPage() {
  let staff: StaffUser[];
  try {
    staff = await api<StaffUser[]>('/admin/staff');
  } catch (error) {
    if (isForbidden(error)) {
      return <AccessDenied area="staff administration" />;
    }
    throw error;
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Staff</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {staff.length} operator{staff.length === 1 ? '' : 's'} with console access ·{' '}
            <Link href="/staff/matrix" className="text-[var(--icb-primary)] hover:underline">
              View permission matrix
            </Link>
          </p>
        </div>
        <Link
          href="/staff/new"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          <Plus size={16} />
          New staff member
        </Link>
      </header>

      <Card className="mt-6 overflow-hidden">
        {staff.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <caption className="sr-only">Staff directory</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">Operator</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Roles</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">2FA</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Last sign-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3">
                      <Link href={`/staff/${member.id}`} className="font-medium hover:underline">
                        {member.firstName} {member.lastName}
                      </Link>
                      <p className="text-xs text-[var(--icb-text-subtle)]">{member.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs capitalize">
                        {member.roles.map((role) => role.replaceAll('_', ' ')).join(', ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={member.active ? 'active' : 'suspended'} />
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {member.mfaEnabled ? (
                        <span className="text-[var(--icb-success-fg)]">Enrolled</span>
                      ) : (
                        <span className="font-medium text-[var(--icb-warning-fg)]">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                      {member.lastLoginAt ? formatDate(member.lastLoginAt, 'medium') : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<KeyRound size={20} />}
            title="No staff yet"
            description="Provision the first operator to open the console."
          />
        )}
      </Card>
    </>
  );
}
