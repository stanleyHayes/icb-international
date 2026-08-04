import { IcbMark } from '@icb/ui';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { readSession } from '@/lib/session';

/**
 * The onboarding room: a signed-in but not-yet-a-customer space.
 *
 * Deliberately not the dashboard shell — the sidebar would promise destinations that make no
 * sense before identity is done. One quiet header, one column, one job at a time.
 */
export default async function OnboardingLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--icb-border)] bg-[var(--icb-surface)]">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2.5 px-5">
          <IcbMark className="h-8 w-8 text-[var(--icb-navy-700)]" id="onboarding" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg leading-none font-extrabold">ICB</span>
            <span className="mt-0.5 text-[0.45rem] leading-none font-semibold tracking-[0.16em] text-[var(--icb-text-subtle)] uppercase">
              Account setup
            </span>
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10">{children}</main>
    </div>
  );
}
