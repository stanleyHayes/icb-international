'use client';

import { cn } from '@icb/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/settings', label: 'Overview' },
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/preferences', label: 'Preferences' },
] as const;

/**
 * Section nav for settings. Active state is exact for the overview and a prefix elsewhere, so
 * /settings/security highlights Security, not both.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="mt-6 mb-8 border-b border-[var(--icb-border)]">
      <ul className="-mb-px flex flex-wrap gap-1">
        {SECTIONS.map((section) => {
          const active =
            section.href === '/settings'
              ? pathname === '/settings'
              : pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--icb-primary)] text-[var(--icb-primary)]'
                    : 'border-transparent text-[var(--icb-text-muted)] hover:border-[var(--icb-border-strong)] hover:text-[var(--icb-text)]',
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
