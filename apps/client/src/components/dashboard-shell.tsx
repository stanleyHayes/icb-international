'use client';

import { CommandPalette, IcbMark, OverlayFrame, PageHelp, cn, initialsOf } from '@icb/ui';
import { ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { CLIENT_NAV, ClientNav, clientRouteContext } from '@/components/client-nav';
import { logoutAction } from '@/features/auth/actions';

const MAIN_ID = 'client-main';

interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
}

function clientHelp(pathname: string) {
  const title = clientRouteContext(pathname)?.item.label ?? 'Online banking';
  const specific: Record<string, readonly string[]> = {
    Transfers: [
      'Choose whether you are moving money between your accounts, to another ICB customer, or to another bank.',
      'Select the paying account, enter the recipient and amount, then request a quote.',
      'Check the fee, arrival time, recipient, and total debit before you confirm.',
    ],
    Accounts: [
      'Review each balance and the amount currently available to spend.',
      'Open an account to see identifiers, recent activity, holds, and statements.',
      'Choose New account only when you want to apply for another banking product.',
    ],
    Cards: [
      'Choose a card to inspect its status, limits, and recent authorisations.',
      'Use card controls to freeze spending, set limits, or report a problem.',
      'Read the confirmation before replacing, blocking, or changing a card.',
    ],
  };
  return {
    title,
    description: `Follow these steps to use the ${title.toLowerCase()} page safely.`,
    steps: specific[title] ?? [
      'Read the summary at the top to understand what is available on this page.',
      'Choose the item or action you want to work with.',
      'Review the details and any fees or warnings before continuing.',
    ],
  };
}

function buildCommands(navigate: (href: Route) => void) {
  return CLIENT_NAV.flatMap((group) =>
    group.items.map((item) => ({
      id: `${group.label}-${item.href}`,
      label: item.label,
      group: group.label,
      keywords: [group.label, item.label],
      icon: <item.icon size={17} aria-hidden="true" />,
      onSelect: () => navigate(item.href),
    })),
  );
}

function ClientWordmark({ collapsed = false }: Readonly<{ collapsed?: boolean }>) {
  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center border-b border-[var(--icb-border)]',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--icb-navy-50)]">
        <IcbMark className="h-7 w-7 text-[var(--icb-primary)]" id="client-shell" />
      </span>
      <span className={cn('min-w-0 flex-col leading-tight', collapsed ? 'hidden' : 'flex')}>
        <span className="font-display truncate text-sm font-semibold tracking-tight">ICB</span>
        <span className="mt-0.5 truncate text-[0.6875rem] font-medium tracking-[0.14em] text-[var(--icb-text-subtle)] uppercase">
          Online banking
        </span>
      </span>
    </div>
  );
}

function ClientAccount({
  user,
  collapsed = false,
}: Readonly<{ user: ShellUser; collapsed?: boolean }>) {
  const name = `${user.firstName} ${user.lastName}`.trim() || 'Customer';
  return (
    <div className={cn('shrink-0 border-t border-[var(--icb-border)] p-3', collapsed && 'px-2')}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg bg-[var(--icb-bg-muted)] px-3 py-2.5',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-primary)] text-xs font-semibold text-white">
          {initialsOf(user.firstName, user.lastName, user.email)}
        </span>
        <span className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-[var(--icb-text-subtle)]">{user.email}</span>
        </span>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--icb-text-muted)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut size={17} aria-hidden="true" />
          <span className={collapsed ? 'sr-only' : undefined}>Sign out</span>
        </button>
      </form>
    </div>
  );
}

function RouteContext({ pathname }: Readonly<{ pathname: string }>) {
  const context = clientRouteContext(pathname);
  const label = context?.item.label ?? 'Online banking';
  return (
    <>
      <div className="hidden min-w-0 items-center gap-1.5 xl:flex">
        <span className="text-xs font-medium text-[var(--icb-text-subtle)]">
          {context?.group ?? 'Overview'}
        </span>
        {context ? <ChevronRight size={14} className="text-[var(--icb-text-subtle)]" /> : null}
        <span className="truncate text-sm font-semibold">{label}</span>
      </div>
      <PageHelp {...clientHelp(pathname)} compact className="h-8 w-8 shrink-0 px-0" />
    </>
  );
}

function ClientTopBar({
  pathname,
  user,
  collapsed,
  onToggleCollapse,
  onOpenNavigation,
  onOpenSearch,
}: Readonly<{
  pathname: string;
  user: ShellUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNavigation: () => void;
  onOpenSearch: () => void;
}>) {
  const collapseLabel = collapsed ? 'Expand navigation' : 'Collapse navigation';
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <header className="relative flex h-16 shrink-0 items-center gap-3 border-b border-[var(--icb-border)] bg-[var(--icb-surface)]/95 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenNavigation}
        aria-label="Show online banking sections"
        className="shrink-0 rounded-md p-1.5 text-[var(--icb-text-muted)] hover:text-[var(--icb-text)] lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapseLabel}
        title={collapseLabel}
        className="hidden shrink-0 rounded-md p-2 text-[var(--icb-text-muted)] hover:text-[var(--icb-text)] lg:inline-flex"
      >
        <CollapseIcon size={17} aria-hidden="true" />
      </button>
      <RouteContext pathname={pathname} />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-2.5 text-sm text-[var(--icb-text-subtle)] transition-colors hover:border-[var(--icb-border-strong)] hover:text-[var(--icb-text-muted)] sm:min-w-56 sm:flex-none lg:absolute lg:left-1/2 lg:w-[min(28rem,34vw)] lg:-translate-x-1/2"
      >
        <Search size={16} className="shrink-0" aria-hidden="true" />
        <span className="truncate">Search online banking</span>
        <kbd className="ml-auto hidden rounded-sm border border-[var(--icb-border)] px-1 font-mono text-xs sm:block">
          ⌘K
        </kbd>
      </button>
      <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-primary)] text-xs font-semibold text-white">
        {initialsOf(user.firstName, user.lastName, user.email)}
      </span>
    </header>
  );
}

export function DashboardShell({
  user,
  children,
}: Readonly<{ user: ShellUser; children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);
  const commands = useMemo(() => buildCommands((href) => router.push(href)), [router]);
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--icb-bg-subtle)] text-[var(--icb-text)]">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[70] focus:rounded-md focus:bg-[var(--icb-surface)] focus:px-3 focus:py-2 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-[var(--icb-border)] bg-[var(--icb-surface)] shadow-[4px_0_24px_rgba(4,20,31,0.025)] transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <ClientWordmark collapsed={collapsed} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ClientNav pathname={pathname} collapsed={collapsed} />
        </div>
        <ClientAccount user={user} collapsed={collapsed} />
      </aside>
      {navOpen ? (
        <OverlayFrame
          onClose={() => setNavOpen(false)}
          labelledBy="mobile-client-title"
          wrapperClassName="lg:hidden"
          className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-[var(--icb-surface)] shadow-[var(--shadow-xl)]"
        >
          <h2 id="mobile-client-title" className="sr-only">
            Online banking sections
          </h2>
          <div className="flex items-start justify-between pr-2">
            <ClientWordmark />
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation"
              className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)]"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ClientNav
              pathname={pathname}
              onNavigate={() => setNavOpen(false)}
              idPrefix="drawer-client-nav"
            />
          </div>
          <ClientAccount user={user} />
        </OverlayFrame>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <ClientTopBar
          {...{ pathname, user, collapsed }}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onOpenNavigation={() => setNavOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main id={MAIN_ID} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
          <div className="client-page mx-auto max-w-[1180px] px-5 py-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        commands={commands}
        placeholder="Search accounts, payments and services…"
        emptyMessage="No online banking section matches."
      />
    </div>
  );
}
