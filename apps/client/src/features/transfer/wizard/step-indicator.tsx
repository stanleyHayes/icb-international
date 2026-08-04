'use client';

import { cn } from '@icb/ui';

const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'quote', label: 'Quote' },
  { id: 'confirm', label: 'Confirm' },
] as const;

export type PricedStep = (typeof STEPS)[number]['id'];

/** The three priced steps, aria-current'd so position in the flow is announced. */
export function StepIndicator({ current }: Readonly<{ current: PricedStep }>) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <ol aria-label="Transfer progress" className="mb-6 flex items-center gap-2">
      {STEPS.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          {index > 0 ? (
            <span aria-hidden="true" className="h-px w-6 bg-[var(--icb-border)]" />
          ) : null}
          <span
            aria-current={index === currentIndex ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              index <= currentIndex ? 'text-[var(--icb-primary)]' : 'text-[var(--icb-text-subtle)]',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem]',
                index <= currentIndex ? 'bg-[var(--icb-primary)] text-white' : 'bg-[var(--icb-bg-muted)]',
              )}
            >
              {index + 1}
            </span>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
