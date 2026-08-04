'use client';

import { IcbMark, cn, initialsOf } from '@icb/ui';
import {
  ArrowLeftRight,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  PiggyBank,
  Receipt,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { logoutAction } from '@/features/auth/actions';
import type { Route } from 'next';

const PRIMARY_NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/transfer', label: 'Transfer', icon: ArrowLeftRight },
  { href: '/beneficiaries', label: 'Payees', icon: Users },
  { href: '/cards', label: 'Cards', icon: CreditCard },
  { href: '/bills', label: 'Bills', icon: ReceiptText },
  { href: '/loans', label: 'Loans', icon: Landmark },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/insights', label: 'Insights', icon: TrendingUp },
] as const;

const SECONDARY_NAV = [
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/account/security', label: 'Security', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
}

export function DashboardShell({
  user,
  children,
}: Readonly<{ user: ShellUser; children: ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <MobileBar onOpen={() => setMobileOpen(true)} user={user} />

      <Sidebar
        pathname={pathname}
        user={user}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="min-w-0">
        <main className="mx-auto max-w-[1100px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function MobileBar({ onOpen, user }: Readonly<{ onOpen: () => void; user: ShellUser }>) {
  return (
    <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--icb-border)] bg-[var(--icb-surface)] px-4 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open navigation"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md"
      >
        <Menu size={20} />
      </button>
      <IcbMark className="h-7 w-7 text-[var(--icb-navy-700)]" id="mobile" />
      <span className="font-display text-lg font-extrabold">ICB</span>
      <span className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--icb-navy-700)] text-xs font-semibold text-white">
        {initialsOf(user.firstName, user.lastName, user.email)}
      </span>
    </div>
  );
}

function Sidebar({
  pathname,
  user,
  open,
  onClose,
}: Readonly<{
  pathname: string;
  user: ShellUser;
  open: boolean;
  onClose: () => void;
}>) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[var(--icb-navy-950)]/50 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[var(--icb-border)] bg-[var(--icb-surface)] transition-transform duration-200 ease-[var(--ease-out)] lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-[72px] items-center gap-2.5 px-5">
          <IcbMark className="h-8 w-8 text-[var(--icb-navy-700)]" id="sidebar" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg leading-none font-extrabold">ICB</span>
            <span className="mt-0.5 text-[0.45rem] leading-none font-semibold tracking-[0.16em] text-[var(--icb-text-subtle)] uppercase">
              Online Banking
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={onClose} />
          ))}

          <div className="!mt-6 border-t border-[var(--icb-border)] pt-3">
            {SECONDARY_NAV.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} onNavigate={onClose} />
            ))}
          </div>
        </nav>

        <div className="border-t border-[var(--icb-border)] p-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-navy-700)] text-xs font-semibold text-white">
              {initialsOf(user.firstName, user.lastName, user.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-[var(--icb-text-subtle)]">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--icb-text-muted)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: Readonly<{
  // A Route: `pathname.startsWith(href)` below still works, and <Link> needs the narrower type.
  href: Route;
  label: string;
  icon: typeof Wallet;
  pathname: string;
  onNavigate: () => void;
}>) {
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--icb-navy-50)] text-[var(--icb-primary)]'
          : 'text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
      )}
    >
      <Icon size={17} className="shrink-0" />
      {label}
    </Link>
  );
}
