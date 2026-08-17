import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/dashboard-shell';
import { ClientChat } from '@/features/chat/client-chat';
import { readSession } from '@/lib/session';

/**
 * The authenticated shell.
 *
 * Session presence is checked here rather than in each page: a route that forgets the check would
 * otherwise leak. Individual API calls are still authorised server-side — this is the first gate,
 * not the only one.
 */
export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <DashboardShell user={session.user}>
      {children}
      <ClientChat />
    </DashboardShell>
  );
}
