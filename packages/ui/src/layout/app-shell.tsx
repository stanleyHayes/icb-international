import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Z_INDEX } from './layout.constants';

/**
 * The application frame: skip link, sidebar column, topbar, and the main content landmark.
 * Apps compose their own Sidebar/Topbar into the slots; the shell owns the geometry.
 */
export type AppShellProps = Readonly<{
  sidebar?: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  className?: string;
}>;

export function AppShell({ sidebar, topbar, children, className }: AppShellProps) {
  return (
    <div className={cn('flex min-h-screen bg-[var(--icb-bg)]', className)}>
      <a
        href="#main-content"
        style={{ zIndex: Z_INDEX.tooltip }}
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4',
          'focus:rounded-[var(--radius-md)] focus:bg-[var(--icb-primary)] focus:px-4 focus:py-2',
          'focus:text-sm focus:font-medium focus:text-white',
        )}
      >
        Skip to content
      </a>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
