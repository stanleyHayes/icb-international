'use client';

import { CircleHelp, Lightbulb } from 'lucide-react';
import { useState } from 'react';

import { cn } from '../lib/cn';
import { Drawer } from './drawer';

export interface PageHelpProps {
  readonly title: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly className?: string;
  readonly compact?: boolean;
}

/** Beginner-friendly, contextual instructions that stay one click away from the page title. */
export function PageHelp({
  title,
  description,
  steps,
  className,
  compact = false,
}: Readonly<PageHelpProps>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`How to use ${title}`}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border border-[var(--icb-border-strong)]',
          'bg-[var(--icb-surface)] px-3 text-xs font-semibold text-[var(--icb-text-muted)]',
          'shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--icb-primary)] hover:text-[var(--icb-primary)]',
          className,
        )}
      >
        <CircleHelp size={16} aria-hidden="true" />
        {compact ? <span className="sr-only">Page help</span> : <span>How to use</span>}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={`How to use ${title}`}>
        <p className="text-sm leading-6 text-[var(--icb-text-muted)]">{description}</p>
        <ol className="mt-5 space-y-3">
          {steps.map((step, index) => (
            <li
              key={step}
              className="grid grid-cols-[2rem_1fr] gap-3 rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] p-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--icb-primary)] text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-sm leading-5 text-[var(--icb-text)]">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--icb-info-border)] bg-[var(--icb-info-bg)] p-3 text-xs leading-5 text-[var(--icb-info-fg)]">
          <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          You can close this guide and reopen it at any time. Nothing is submitted until you use the
          page&apos;s final confirmation button.
        </p>
      </Drawer>
    </>
  );
}
