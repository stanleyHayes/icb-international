import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * A named block of page content.
 *
 * When `title` is provided the section renders a heading and wires `aria-labelledby`, so
 * assistive tech announces the region by name. Pass `id` to make the association stable.
 */
export type SectionProps = Readonly<
  HTMLAttributes<HTMLElement> & {
    title?: ReactNode;
    description?: ReactNode;
    /** Slot for actions aligned with the heading (e.g. "View all"). */
    actions?: ReactNode;
  }
>;

export function Section({
  id,
  title,
  description,
  actions,
  className,
  children,
  ...props
}: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('flex flex-col gap-4', className)}
      {...props}
    >
      {title ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--icb-text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
