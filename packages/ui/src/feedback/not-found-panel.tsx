import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The 404 body, written in the bank's own vernacular.
 *
 * A bank resolves references: account numbers, sort codes, statement lines. A missing page is
 * the same event — a reference that returns no record — so it is presented that way, with the
 * requested path set in the mono face the product already uses for data. The status code appears
 * once, as a value in that record, rather than as a large decorative number that says nothing a
 * customer can act on.
 *
 * `reference` is the requested path. Callers pass it from `usePathname()`; when it is absent the
 * record block collapses to the status row rather than rendering an empty field.
 */
export function NotFoundPanel({
  reference,
  title = 'We can’t find that page',
  description = 'The link may be out of date, or the address may have been mistyped.',
  eyebrow = 'No matching record',
  actions,
  className,
}: Readonly<{
  reference?: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col items-start px-6 py-20 sm:py-28',
        className,
      )}
    >
      <p className="text-[0.6875rem] font-semibold tracking-[var(--icb-tracking-caps)] text-[var(--icb-accent-text)] uppercase">
        {eyebrow}
      </p>

      <h1 className="font-display mt-4 text-[var(--icb-text-3xl)] leading-[var(--icb-leading-tight)] font-extrabold tracking-[var(--icb-tracking-tight)] text-balance text-[var(--icb-text)]">
        {title}
      </h1>

      <p className="mt-3 text-[var(--icb-text-base)] leading-[var(--icb-leading-normal)] text-[var(--icb-text-muted)]">
        {description}
      </p>

      {/*
        The record. Hairline rules and a label column, matching how a posting is shown elsewhere
        in the product — the failure is legible as data, and the reference is selectable so it can
        be pasted straight into a support message.
      */}
      <dl className="mt-8 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-[var(--icb-text-sm)]">
        {reference ? (
          <div className="flex gap-4 border-b border-[var(--icb-border)] px-4 py-3">
            <dt className="w-24 shrink-0 font-mono text-[var(--icb-text-2xs)] tracking-[var(--icb-tracking-wide)] text-[var(--icb-text-subtle)] uppercase">
              Reference
            </dt>
            <dd className="min-w-0 font-mono break-all text-[var(--icb-text)]">{reference}</dd>
          </div>
        ) : null}
        <div className="flex gap-4 px-4 py-3">
          <dt className="w-24 shrink-0 font-mono text-[var(--icb-text-2xs)] tracking-[var(--icb-tracking-wide)] text-[var(--icb-text-subtle)] uppercase">
            Status
          </dt>
          <dd className="font-mono text-[var(--icb-text-muted)]">404 · Not found</dd>
        </div>
      </dl>

      {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
