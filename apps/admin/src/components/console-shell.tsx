'use client';

import { CommandPalette, OverlayFrame, PageHelp, cn, initialsOf } from '@icb/ui';
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { navForRoles } from '@/components/console-nav';
import {
  ConsoleAccount,
  ConsoleNav,
  ConsoleWordmark,
  type ConsoleUser,
} from '@/components/console-sidebar';

const MAIN_ID = 'console-main';

function buildCommands(user: ConsoleUser, navigate: (href: Route) => void) {
  return navForRoles(user.roles).flatMap((group) =>
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

function routeContext(pathname: string, user: ConsoleUser) {
  return (
    navForRoles(user.roles)
      .flatMap((group) => group.items.map((item) => ({ group: group.label, item })))
      .filter(({ item }) =>
        item.href === '/'
          ? pathname === '/'
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.item.href.length - a.item.href.length)[0] ?? null
  );
}

function helpFor(label: string) {
  const specific: Record<string, readonly string[]> = {
    Accounts: [
      'Search with an account number, IBAN, customer name, email, or phone number.',
      'Open the matching account to review balances, holds, interest, and account status.',
      'Use the operation panels for deposits, withdrawals, limits, or product changes; privileged changes go to approval.',
    ],
    Approvals: [
      'Filter the inbox by request status and operation type.',
      'Open a request and compare the proposed change with the customer and ledger context.',
      'Approve or reject with a clear reason. You cannot approve a request you created yourself.',
    ],
    Customers: [
      'Search by name, email, phone number, or account number.',
      'Use status and risk filters to narrow the directory.',
      'Open a customer to review identity, accounts, relationship value, and available actions.',
    ],
    Operations: [
      'Review the operational totals and ledger health at the top of the page.',
      'Open any warning or queue that needs attention.',
      'Use the recent activity table to confirm what changed and who performed it.',
    ],
  };
  return {
    title: label,
    description: `A beginner-friendly walkthrough of the ${label.toLowerCase()} workspace.`,
    steps: specific[label] ?? [
      'Review the summary and any warning messages at the top of the page.',
      'Use the available search or filters to narrow the work list.',
      'Open an item to review its details before taking an action.',
      'Read the confirmation carefully before submitting any change.',
    ],
  };
}

function TopBarRoute({ pathname, user }: Readonly<{ pathname: string; user: ConsoleUser }>) {
  const context = routeContext(pathname, user);
  const label = context?.item.label ?? 'Operations';
  return (
    <>
      <div className="hidden min-w-0 items-center gap-1.5 xl:flex">
        <span className="text-xs font-medium text-[var(--icb-text-subtle)]">
          {context?.group ?? 'Overview'}
        </span>
        {context ? <ChevronRight size={14} className="text-[var(--icb-text-subtle)]" /> : null}
        <span className="truncate text-sm font-semibold">{label}</span>
      </div>
      <PageHelp {...helpFor(label)} compact className="h-8 w-8 shrink-0 px-0" />
    </>
  );
}

function TopBar({
  pathname,
  user,
  collapsed,
  onToggleCollapse,
  onOpenNavigation,
  onOpenSearch,
}: Readonly<{
  pathname: string;
  user: ConsoleUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNavigation: () => void;
  onOpenSearch: () => void;
}>) {
  const collapseLabel = collapsed ? 'Expand navigation' : 'Collapse navigation';
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const userName = user.firstName ? `${user.firstName} ${user.lastName}` : 'Operations';
  return (
    <header className="relative flex h-16 shrink-0 items-center gap-3 border-b border-[var(--icb-border)] bg-[var(--icb-surface)]/95 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenNavigation}
        aria-label="Show console sections"
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
        <CollapseIcon size={17} />
      </button>
      <TopBarRoute pathname={pathname} user={user} />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-2.5 text-sm text-[var(--icb-text-subtle)] transition-colors hover:border-[var(--icb-border-strong)] hover:text-[var(--icb-text-muted)] sm:min-w-56 sm:flex-none lg:absolute lg:left-1/2 lg:w-[min(28rem,34vw)] lg:-translate-x-1/2"
      >
        <Search size={16} className="shrink-0" aria-hidden="true" />
        <span className="truncate">Search the bank</span>
        <kbd className="ml-auto hidden rounded-sm border border-[var(--icb-border)] px-1 font-mono text-xs sm:block">
          ⌘K
        </kbd>
      </button>
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--icb-primary)] text-xs font-semibold text-white">
          {initialsOf(user.firstName, user.lastName, user.email)}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-36 truncate text-sm font-semibold">{userName}</span>
          <span className="block max-w-36 truncate text-xs text-[var(--icb-text-subtle)]">
            {user.email}
          </span>
        </span>
      </div>
    </header>
  );
}

export function ConsoleShell({
  user,
  children,
}: Readonly<{ user: ConsoleUser; children: ReactNode }>) {
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

  const commands = useMemo(() => buildCommands(user, (href) => router.push(href)), [router, user]);

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
        <ConsoleWordmark collapsed={collapsed} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConsoleNav roles={user.roles} pathname={pathname} collapsed={collapsed} />
        </div>
        <ConsoleAccount user={user} collapsed={collapsed} />
      </aside>
      {navOpen ? (
        <OverlayFrame
          onClose={() => setNavOpen(false)}
          labelledBy="mobile-console-title"
          wrapperClassName="lg:hidden"
          className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col bg-[var(--icb-surface)] shadow-[var(--shadow-xl)]"
        >
          <h2 id="mobile-console-title" className="sr-only">
            Console sections
          </h2>
          <div className="flex items-start justify-between pr-2">
            <ConsoleWordmark markId="console-drawer" />
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close console navigation"
              className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)]"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConsoleNav
              roles={user.roles}
              pathname={pathname}
              onNavigate={() => setNavOpen(false)}
              idPrefix="drawer-nav"
            />
          </div>
          <ConsoleAccount user={user} />
        </OverlayFrame>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          {...{ pathname, user, collapsed }}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onOpenNavigation={() => setNavOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main id={MAIN_ID} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
          <div className="console-page mx-auto max-w-[1180px] px-5 py-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        commands={commands}
        placeholder="Search console sections…"
        emptyMessage="No console section matches."
      />
    </div>
  );
}
