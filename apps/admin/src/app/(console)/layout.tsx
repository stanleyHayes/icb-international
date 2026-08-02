import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ConsoleShell } from '@/components/console-shell';
import { readSession } from '@/lib/session';

export default async function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  return <ConsoleShell user={session.user}>{children}</ConsoleShell>;
}
