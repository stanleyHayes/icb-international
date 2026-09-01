'use client';

import { cn } from '@icb/ui';
import {
  ArrowLeftRight,
  ChevronRight,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  PiggyBank,
  Receipt,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

export interface ClientNavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
}
export interface ClientNavGroup {
  label: string;
  items: readonly ClientNavItem[];
}

export const CLIENT_NAV: readonly ClientNavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Home', icon: LayoutDashboard },
      { href: '/accounts', label: 'Accounts', icon: Wallet },
      { href: '/transactions', label: 'Transactions', icon: Receipt },
      { href: '/insights', label: 'Insights', icon: TrendingUp },
    ],
  },
  {
    label: 'Move money',
    items: [
      { href: '/transfer', label: 'Transfers', icon: ArrowLeftRight },
      { href: '/beneficiaries', label: 'Payees', icon: Users },
      { href: '/bills', label: 'Bills', icon: ReceiptText },
    ],
  },
  {
    label: 'Products',
    items: [
      { href: '/cards', label: 'Cards', icon: CreditCard },
      { href: '/loans', label: 'Loans', icon: Landmark },
      { href: '/savings', label: 'Savings', icon: PiggyBank },
      { href: '/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Your account',
    items: [
      { href: '/support', label: 'Support', icon: LifeBuoy },
      { href: '/account/security', label: 'Security', icon: ShieldCheck },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function clientRouteContext(pathname: string) {
  return (
    CLIENT_NAV.flatMap((group) => group.items.map((item) => ({ group: group.label, item })))
      .filter(({ item }) =>
        item.href === '/'
          ? pathname === '/'
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.item.href.length - a.item.href.length)[0] ?? null
  );
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function GroupTrigger({
  group,
  labelId,
  active,
  expanded,
  collapsed,
  onToggle,
}: Readonly<{
  group: ClientNavGroup;
  labelId: string;
  active: boolean;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
}>) {
  const GroupIcon = group.items[0]?.icon;
  return (
    <button
      id={labelId}
      type="button"
      aria-expanded={expanded}
      title={collapsed ? group.label : undefined}
      onClick={onToggle}
      className={cn(
        'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--icb-text-subtle)] uppercase transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
        active && 'text-[var(--icb-primary)]',
        collapsed && 'justify-center px-0',
      )}
    >
      {GroupIcon ? <GroupIcon size={16} className="shrink-0" aria-hidden="true" /> : null}
      <span className={collapsed ? 'sr-only' : 'min-w-0 flex-1 truncate text-left'}>
        {group.label}
      </span>
      {collapsed ? null : (
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={cn('shrink-0 transition-transform', expanded && 'rotate-90')}
        />
      )}
    </button>
  );
}

function GroupItems({
  group,
  pathname,
  collapsed,
  onNavigate,
  labelId,
}: Readonly<{
  group: ClientNavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  labelId: string;
}>) {
  return (
    <ul
      aria-labelledby={labelId}
      className={cn(
        'mt-1 flex flex-col gap-0.5',
        !collapsed && 'relative ml-4 border-l border-[var(--icb-border)] pl-3',
      )}
    >
      {group.items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li
            key={item.href}
            className={cn(
              !collapsed &&
                'relative before:absolute before:top-1/2 before:-left-3 before:w-3 before:border-t before:border-[var(--icb-border)]',
            )}
          >
            <Link
              href={item.href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-[var(--icb-navy-50)] text-[var(--icb-primary)]'
                  : 'text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
              )}
            >
              <item.icon size={17} className="shrink-0" aria-hidden="true" />
              <span className={collapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ClientNavGroupView({
  group,
  pathname,
  collapsed,
  onNavigate,
  idPrefix,
}: Readonly<{
  group: ClientNavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  idPrefix: string;
}>) {
  const active = group.items.some((item) => isActive(pathname, item.href));
  const [open, setOpen] = useState(true);
  const expanded = open || active;
  const labelId = `${idPrefix}-${group.label.toLowerCase().replaceAll(' ', '-')}`;
  const navigationProps = onNavigate ? { onNavigate } : {};
  const items = expanded ? (
    <GroupItems {...{ group, pathname, collapsed, labelId }} {...navigationProps} />
  ) : null;
  return (
    <section>
      <GroupTrigger
        {...{ group, labelId, active, expanded, collapsed }}
        onToggle={() => setOpen((value) => !value)}
      />
      {items}
    </section>
  );
}

export function ClientNav({
  pathname,
  collapsed = false,
  onNavigate,
  idPrefix = 'client-nav',
}: Readonly<{
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  idPrefix?: string;
}>) {
  return (
    <nav
      aria-label="Online banking sections"
      className={cn('flex flex-col py-4', collapsed ? 'gap-3 px-2' : 'gap-5 px-3')}
    >
      {CLIENT_NAV.map((group) => (
        <ClientNavGroupView
          key={group.label}
          {...{ group, pathname, collapsed, idPrefix }}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </nav>
  );
}
