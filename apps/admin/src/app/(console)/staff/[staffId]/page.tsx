import type { AuditEvent, OffsetPage, Session, StaffUser } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AccessDenied } from '@/components/access-denied';
import { AuditEventTable } from '@/features/audit/audit-event-table';
import { EditStaffForm } from '@/features/staff/edit-staff-form';
import { SessionList } from '@/features/staff/session-list';
import { api } from '@/lib/api';
import { isForbidden, isNotFound } from '@/lib/guards';
import { readSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Staff member' };

/**
 * One operator: who they are, what they can do, and what they have done.
 *
 * The action audit is filtered server-side by actor, so "what has this person touched?" is a
 * question the trail itself answers. The session list appears only on your own profile —
 * revoking another operator's sessions is not something the API permits per-user.
 */
export default async function StaffDetailPage({
  params,
}: Readonly<{ params: Promise<{ staffId: string }> }>) {
  const { staffId } = await params;
  const session = await readSession();
  const isSelf = session?.user.userId === staffId;

  const staff = await loadStaff(staffId);
  if (staff === 'forbidden') {
    return <AccessDenied area="staff administration" />;
  }
  if (staff === 'missing') {
    notFound();
  }

  const [actions, sessions] = await Promise.all([loadActions(staffId), loadSessions(isSelf)]);

  return (
    <>
      <header>
        <p className="text-sm text-[var(--icb-text-subtle)]">
          <Link href="/staff" className="hover:underline">
            Staff
          </Link>
          {' / '}
          {staff.firstName} {staff.lastName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {staff.firstName} {staff.lastName}
          </h1>
          <StatusBadge status={staff.active ? 'active' : 'suspended'} />
        </div>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {staff.email} · member since {formatDate(staff.createdAt, 'medium')} · last sign-in{' '}
          {staff.lastLoginAt ? formatDate(staff.lastLoginAt, 'medium') : 'never'}
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Roles & access"
            description="Changes take effect on the operator's next request and are audited."
          />
          <CardBody>
            <EditStaffForm staff={staff} isSelf={isSelf} />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Two-factor authentication" />
            <CardBody>
              {staff.mfaEnabled ? (
                <p className="text-sm text-[var(--icb-success-fg)]">Enrolled</p>
              ) : (
                <p className="text-sm text-[var(--icb-warning-fg)]">
                  Not yet enrolled — the console stays locked for this operator until enrolment is
                  complete.
                </p>
              )}
            </CardBody>
          </Card>

          {sessions ? (
            <Card>
              <CardHeader title="Your sessions" description="Revoking signs that device out." />
              <CardBody>
                <SessionList sessions={sessions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {actions ? (
        <section aria-labelledby="staff-actions" className="mt-8">
          <h2 id="staff-actions" className="text-lg font-semibold">
            Recent actions
          </h2>
          <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
            The last {actions.items.length} audited events attributed to this operator.
          </p>
          <div className="mt-4">
            <AuditEventTable events={actions.items} />
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Fetch one operator, mapping the two expected refusals to sentinels the page renders. */
async function loadStaff(staffId: string): Promise<StaffUser | 'forbidden' | 'missing'> {
  try {
    return await api<StaffUser>(`/admin/staff/${staffId}`);
  } catch (error) {
    if (isForbidden(error)) {
      return 'forbidden';
    }
    if (isNotFound(error)) {
      return 'missing';
    }
    throw error;
  }
}

/** Recent audited events for one operator; the section hides if the trail read is refused. */
async function loadActions(staffId: string): Promise<OffsetPage<AuditEvent> | null> {
  try {
    return await api<OffsetPage<AuditEvent>>(`/admin/audit/events?actorId=${staffId}&limit=10`);
  } catch {
    return null;
  }
}

/** The operator's own sessions — only ever requested for the signed-in user themselves. */
async function loadSessions(isSelf: boolean): Promise<Session[] | null> {
  if (!isSelf) {
    return null;
  }
  try {
    return await api<Session[]>('/auth/sessions');
  } catch {
    return [];
  }
}
