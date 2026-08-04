import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The top of every management view: breadcrumbs for context, one `h1` for the page,
 * a muted description, and the page-level actions on the right.
 */
export type PageHeaderProps = Readonly<{
  title: ReactNode;
  description?: ReactNode;
  /** Usually `<Breadcrumbs />`; rendered above the title. */
  breadcrumbs?: ReactNode;
  /** Page-level actions (primary first). */
  actions?: ReactNode;
  className?: string;
}>;

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {breadcrumbs}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[var(--icb-text-2xl)] leading-[var(--icb-leading-tight)]">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--icb-text-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
