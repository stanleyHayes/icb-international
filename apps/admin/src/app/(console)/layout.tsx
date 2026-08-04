import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ConsoleShell } from '@/components/console-shell';
import { readSession } from '@/lib/session';

export default async function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  // Staff policy: no console without an enrolled second factor. The gate page is the only
  // authenticated surface reachable until this flips.
  if (session.user.roles.length > 0 && !session.user.mfaEnabled) {
    redirect('/mfa-enrol');
  }

  return <ConsoleShell user={session.user}>{children}</ConsoleShell>;
}
