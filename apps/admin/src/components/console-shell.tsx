'use client';

import { IcbMark, cn, initialsOf } from '@icb/ui';
import { Activity, BookOpen, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { logoutAction } from '@/features/auth/actions';

const NAV = [
  { href: '/', label: 'Operations', icon: LayoutDashboard },
  { href: '/ledger', label: 'Trial balance', icon: BookOpen },
  { href: '/monitor', label: 'Monitor', icon: Activity },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/kyc', label: 'KYC queue', icon: ShieldCheck },
] as const;

interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * The console shell.
 *
 * Visually distinct from the customer dashboard on purpose: staff frequently have both open, and
 * a dark chrome makes it impossible to mistake one for the other mid-task.
 */
export function ConsoleShell({
  user,
  children,
}: Readonly<{ user: ShellUser; children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-[var(--icb-navy-950)] text-[var(--icb-navy-100)] lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex h-[72px] items-center gap-2.5 px-5">
          <IcbMark className="h-8 w-8 text-white" id="console" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg leading-none font-extrabold text-white">ICB</span>
            <span className="mt-0.5 text-[0.45rem] leading-none font-semibold tracking-[0.16em] text-[var(--icb-navy-300)] uppercase">
              Operations Console
            </span>
          </span>
        </div>

        <nav aria-label="Console" className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-[var(--icb-navy-200)] hover:bg-white/5 hover:text-white',
                )}
              >
                <item.icon size={17} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-accent)] text-xs font-semibold text-[var(--icb-navy-900)]">
              {initialsOf(user.firstName, user.lastName, user.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user.firstName ? `${user.firstName} ${user.lastName}` : 'Operations'}
              </p>
              <p className="truncate text-xs text-[var(--icb-navy-300)]">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--icb-navy-200)] transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
