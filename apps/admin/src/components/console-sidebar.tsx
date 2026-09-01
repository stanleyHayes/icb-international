'use client';

import { IcbMark, cn, initialsOf } from '@icb/ui';
import { ChevronRight, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { navForRoles, type ConsoleNavGroup } from '@/components/console-nav';
import { logoutAction } from '@/features/auth/actions';

export interface ConsoleUser {
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

export function ConsoleWordmark({
  collapsed = false,
  markId = 'console',
}: Readonly<{ collapsed?: boolean; markId?: string }> = {}) {
  return (
    <div
      className={cn(
        'flex h-16 shrink-0 items-center border-b border-[var(--icb-border)]',
        collapsed ? 'justify-center px-2' : 'gap-3 px-4',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--icb-navy-50)]">
        <IcbMark className="h-7 w-7 text-[var(--icb-primary)]" id={markId} />
      </span>
      <span className={cn('min-w-0 flex-col leading-tight', collapsed ? 'hidden' : 'flex')}>
        <span className="font-display truncate text-sm font-semibold tracking-tight">ICB</span>
        <span className="mt-0.5 truncate text-[0.6875rem] font-medium tracking-[0.14em] text-[var(--icb-text-subtle)] uppercase">
          Operations
        </span>
      </span>
    </div>
  );
}

function GroupItems({
  group,
  pathname,
  collapsed,
  onNavigate,
  labelId,
}: Readonly<{
  group: ConsoleNavGroup;
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
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
              {...(collapsed ? { title: item.label } : {})}
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

function isPathActive(pathname: string, href: string): boolean {
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
  group: ConsoleNavGroup;
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
      {...(collapsed ? { title: group.label } : {})}
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
      {!collapsed ? (
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={cn('shrink-0 transition-transform', expanded && 'rotate-90')}
        />
      ) : null}
    </button>
  );
}

function NavGroup({
  group,
  pathname,
  collapsed,
  onNavigate,
  idPrefix,
}: Readonly<{
  group: ConsoleNavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  idPrefix: string;
}>) {
  const active = group.items.some((item) => isPathActive(pathname, item.href));
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

export function ConsoleNav({
  roles,
  pathname,
  collapsed = false,
  onNavigate,
  idPrefix = 'console-nav',
}: Readonly<{
  roles: string[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  idPrefix?: string;
}>) {
  return (
    <nav
      aria-label="Console sections"
      className={cn('flex flex-col py-4', collapsed ? 'gap-3 px-2' : 'gap-5 px-3')}
    >
      {navForRoles(roles).map((group) => (
        <NavGroup
          key={group.label}
          {...{ group, pathname, collapsed, idPrefix }}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </nav>
  );
}

export function ConsoleAccount({
  user,
  collapsed = false,
}: Readonly<{ user: ConsoleUser; collapsed?: boolean }>) {
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
        <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
          <p className="truncate text-sm font-medium">
            {user.firstName ? `${user.firstName} ${user.lastName}` : 'Operations'}
          </p>
          <p className="truncate text-xs text-[var(--icb-text-subtle)]">{user.email}</p>
        </div>
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
