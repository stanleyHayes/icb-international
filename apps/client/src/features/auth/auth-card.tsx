import { IcbMark } from '@icb/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Route } from 'next';

// Typed at the constant: an absolute URL to another origin, which typedRoutes cannot know.
const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ??
  'http://localhost:3100') as Route;

/**
 * The quiet, centred shell every pre-auth screen shares: logo, a title, one column of content.
 *
 * Sign-in keeps its split-panel design because it is the front door; the flows that hang off it
 * (reset, recovery, verification) are errands — they get a plainer room so the task stays the
 * loudest thing on the page.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: Readonly<{ title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-6 py-12 sm:py-16">
      <Link
        href={MARKETING_URL}
        aria-label="ICB home"
        className="flex items-center gap-2.5"
      >
        <IcbMark className="h-9 w-9 text-[var(--icb-navy-700)]" id="auth-card" />
        <span className="flex flex-col leading-none">
          <span className="font-display text-xl leading-none font-extrabold">ICB</span>
          <span className="mt-0.5 text-[0.5rem] leading-none font-semibold tracking-[0.16em] text-[var(--icb-text-subtle)] uppercase">
            Online Banking
          </span>
        </span>
      </Link>

      <div className="mt-10 w-full max-w-md">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-[var(--icb-text-muted)]">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-8 text-sm text-[var(--icb-text-muted)]">{footer}</div> : null}
      </div>
    </div>
  );
}
