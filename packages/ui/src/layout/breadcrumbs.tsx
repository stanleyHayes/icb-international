import { Fragment } from 'react';

import { cn } from '../lib/cn';
import { IconChevronRight } from '../primitives/icons';

/**
 * Wayfinding for deep hierarchies (admin console, settings). The current page is plain text
 * with `aria-current="page"` — never a link to itself.
 */
export interface BreadcrumbItem {
  label: string;
  /** Omit on the last item; it is the current page. */
  href?: string;
}

export function Breadcrumbs({
  items,
  className,
}: Readonly<{ items: readonly BreadcrumbItem[]; className?: string }>) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <li aria-hidden="true" className="flex text-[var(--icb-text-subtle)]">
                <IconChevronRight size="sm" />
              </li>
            ) : null}
            <li className="flex items-center">
              {item.href ? (
                <a
                  href={item.href}
                  className="text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
                >
                  {item.label}
                </a>
              ) : (
                <span aria-current="page" className="font-medium text-[var(--icb-text)]">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
