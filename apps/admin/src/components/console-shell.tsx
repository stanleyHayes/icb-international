'use client';

import { IcbMark, OverlayFrame, cn } from '@icb/ui';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';

import {
  ConsoleAccount,
  ConsoleNav,
  ConsoleWordmark,
  type ConsoleUser,
} from '@/components/console-sidebar';

/**
 * The console shell.
 *
 * Visually distinct from the customer dashboard on purpose: staff frequently have both open, and
 * a dark chrome makes it impossible to mistake one for the other mid-task.
 *
 * Below `lg` the sidebar is a drawer rather than a column. The two-column grid collapses on a
 * narrow screen, which stacked the whole navigation — every group, every item, the user card and
 * sign-out — on top of the page, so an operator on a phone scrolled past the entire console to
 * reach the thing they had just opened. The drawer gives the top of the screen back to the work.
 */
export function ConsoleShell({
  user,
  children,
}: Readonly<{ user: ConsoleUser; children: ReactNode }>) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const drawerTitleId = useId();

  // Navigating is the implicit "done" for the drawer; leaving it open would cover the page the
  // operator just asked for.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Widening past the breakpoint hides the drawer by CSS but does not unmount it, so its scroll
  // lock would survive as a page that cannot be scrolled and no visible overlay to explain why.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)');
    const close = (event: MediaQueryListEvent) => {
      if (event.matches) setNavOpen(false);
    };
    desktop.addEventListener('change', close);
    return () => desktop.removeEventListener('change', close);
  }, []);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden bg-[var(--icb-navy-950)] text-[var(--icb-navy-100)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <ConsoleWordmark />
        <ConsoleNav roles={user.roles} pathname={pathname} />
        <ConsoleAccount user={user} />
      </aside>

      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-2.5 border-b border-white/10 bg-[var(--icb-navy-950)] px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={navOpen}
          aria-label="Open console navigation"
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--icb-navy-100)] transition-colors hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
        <IcbMark className="h-7 w-7 shrink-0 text-white" id="console-mobile" />
        <span className="font-display text-base leading-none font-extrabold text-white">ICB</span>
        <span className="text-[0.45rem] leading-tight font-semibold tracking-[0.16em] text-[var(--icb-navy-300)] uppercase">
          Operations
          <br />
          Console
        </span>
      </header>

      {navOpen ? (
        <OverlayFrame
          onClose={() => setNavOpen(false)}
          labelledBy={drawerTitleId}
          wrapperClassName="lg:hidden"
          className={cn(
            'absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col',
            'bg-[var(--icb-navy-950)] text-[var(--icb-navy-100)] shadow-[var(--shadow-xl)]',
            'motion-safe:animate-[icb-slide-in-left_var(--icb-duration-normal)_var(--icb-ease-out)_both]',
          )}
        >
          <div className="flex items-start justify-between pr-2">
            <div id={drawerTitleId}>
              <ConsoleWordmark markId="console-drawer" />
            </div>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close console navigation"
              className="mt-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--icb-navy-200)] transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <ConsoleNav roles={user.roles} pathname={pathname} />
          <ConsoleAccount user={user} />
        </OverlayFrame>
      ) : null}

      <div className="min-w-0">
        <main className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
