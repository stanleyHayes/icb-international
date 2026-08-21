'use client';

import { NotFoundPanel } from '@icb/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Supplies the requested path to the 404 panel.
 *
 * Exists only because `usePathname` needs a client component and `not-found.tsx` has to stay a
 * server component to export metadata. Everything visual lives in NotFoundPanel.
 */
export function NotFoundView() {
  const pathname = usePathname();

  return (
    <NotFoundPanel
      reference={pathname}
      description="The link may be out of date. Your accounts and payments are unaffected."
      actions={
        <>
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--icb-primary-hover)] focus-ring">
            Back to dashboard
          </Link>
          <Link href="/support" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-5 text-sm font-semibold text-[var(--icb-text)] transition-colors hover:bg-[var(--icb-bg-muted)] focus-ring">
            Get help
          </Link>
        </>
      }
    />
  );
}
