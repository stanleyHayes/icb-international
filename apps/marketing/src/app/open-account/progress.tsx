import { Check } from 'lucide-react';

import type { FunnelStep } from './schema';

type StepState = 'done' | 'current' | 'todo';

function stepState(index: number, current: number): StepState {
  if (index < current) return 'done';
  return index === current ? 'current' : 'todo';
}

/**
 * The funnel's step indicator.
 *
 * An ordered list so screen readers announce "step 2 of 4"; the current step carries
 * `aria-current="step"`. Steps before the current one show a check — the draft behind them is
 * valid and retained, and clicking the number is deliberately not offered so keyboard flow has
 * exactly one path: Continue and Back.
 */
export function FunnelProgress({
  steps,
  current,
}: Readonly<{ steps: readonly FunnelStep[]; current: number }>) {
  return (
    <nav aria-label="Application progress" className="mb-8">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const state = stepState(index, current);
          return (
            <li key={step.id} className="flex min-w-0 flex-1 flex-col gap-2">
              <span
                aria-hidden="true"
                className={`h-1 rounded-full transition-colors ${
                  state === 'todo' ? 'bg-[var(--icb-border)]' : 'bg-[var(--icb-primary)]'
                }`}
              />
              <span className="flex items-center gap-1.5 text-xs">
                <StepBadge index={index} state={state} />
                <span
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={`truncate ${
                    state === 'current'
                      ? 'font-semibold text-[var(--icb-text)]'
                      : 'text-[var(--icb-text-subtle)]'
                  }`}
                >
                  {step.title}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepBadge({ index, state }: Readonly<{ index: number; state: StepState }>) {
  if (state === 'done') {
    return (
      <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--icb-primary)] text-white">
        <Check size={11} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`tabular flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold ${
        state === 'current'
          ? 'border-[var(--icb-primary)] text-[var(--icb-primary)]'
          : 'border-[var(--icb-border-strong)] text-[var(--icb-text-subtle)]'
      }`}
    >
      {index + 1}
    </span>
  );
}
