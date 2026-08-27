'use client';

import { IcbMark, cn, initialsOf } from '@icb/ui';
import { LogOut } from 'lucide-react';
import Link from 'next/link';

import { navForRoles } from '@/components/console-nav';
import { logoutAction } from '@/features/auth/actions';

export interface ConsoleUser {
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

/**
 * The three pieces of the console sidebar, split out because both the desktop rail and the mobile
 * drawer render exactly the same content. Keeping them here means the two presentations cannot
 * drift into showing an operator different navigation depending on the width of their screen.
 */
export function ConsoleWordmark({ markId = 'console' }: Readonly<{ markId?: string }> = {}) {
  return (
    <div className="flex h-[72px] shrink-0 items-center gap-2.5 px-5">
      {/* `markId` namespaces the mark's gradient and mask ids. The desktop rail is display:none
          below lg rather than unmounted, so it and the drawer are in the DOM at the same time and
          a shared id would have the second instance resolve against the first. */}
      <IcbMark className="h-8 w-8 text-white" id={markId} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg leading-none font-extrabold text-white">ICB</span>
        <span className="mt-0.5 text-[0.45rem] leading-none font-semibold tracking-[0.16em] text-[var(--icb-navy-300)] uppercase">
          Operations Console
        </span>
      </span>
    </div>
  );
}

/** RBAC-aware navigation: an operator sees exactly the sections their roles can open. */
export function ConsoleNav({
  roles,
  pathname,
}: Readonly<{ roles: string[]; pathname: string }>) {
  return (
    <nav aria-label="Console" className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
      {navForRoles(roles).map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-[0.6rem] font-semibold tracking-[0.14em] text-[var(--icb-navy-400)] uppercase">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
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
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Who is signed in, and the way out. */
export function ConsoleAccount({ user }: Readonly<{ user: ConsoleUser }>) {
  return (
    <div className="shrink-0 border-t border-white/10 p-3">
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
  );
}
