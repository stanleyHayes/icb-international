import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/dashboard-shell';
import { readSession } from '@/lib/session';

/**
 * Authenticated account-security screens.
 *
 * These live outside `(dashboard)` because they belong to the auth mission, but they present
 * with the same shell and the same session gate as the rest of the signed-in product — the
 * customer cannot tell where one mission's files end and another's begin, which is the point.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
