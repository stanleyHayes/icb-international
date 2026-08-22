'use client';

import { IcbLogo, cn } from '@icb/ui';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/personal', label: 'Personal' },
  { href: '/business', label: 'Business' },
  { href: '/wealth', label: 'Wealth' },
  { href: '/rates', label: 'Rates & fees' },
  { href: '/security', label: 'Security' },
  { href: '/support', label: 'Support' },
] as const;

const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3101';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--icb-border)] bg-[var(--icb-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-8 px-5">
        <Link href="/" aria-label="ICB home" className="shrink-0">
          <IcbLogo id="header" />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'text-[var(--icb-primary)]'
                    : 'text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`${CLIENT_URL}/login`}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--icb-text)] transition-colors hover:bg-[var(--icb-bg-muted)] sm:inline-flex"
          >
            Sign in
          </a>
          <Link
            href="/open-account"
            className="hidden h-10 items-center rounded-md bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)] md:inline-flex"
          >
            Open an account
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md md:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="origin-top animate-[icb-pop_var(--icb-duration-normal)_var(--icb-ease-out)_both] border-t border-[var(--icb-border)] px-5 py-3 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[var(--icb-bg-muted)]"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={`${CLIENT_URL}/login`}
            className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-[var(--icb-bg-muted)]"
          >
            Sign in
          </a>
          <Link
            href="/open-account"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
          >
            Open an account
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
