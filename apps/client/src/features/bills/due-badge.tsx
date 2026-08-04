import { cn } from '@icb/ui';

const DAY_MS = 86_400_000;

/**
 * The due reminder. A bill due "soon" is only useful if soon is a number, so the badge says the
 * days — and turns urgent inside a week, overdue past zero.
 */
export function DueBadge({ dueOn }: Readonly<{ dueOn: string }>) {
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(dueOn) - Date.parse(today)) / DAY_MS);

  const { label, tone } = describe(days);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tone,
      )}
    >
      {label}
    </span>
  );
}

function describe(days: number): { label: string; tone: string } {
  if (days < 0) {
    return {
      label: `Overdue by ${Math.abs(days)} day${days === -1 ? '' : 's'}`,
      tone: 'bg-[var(--icb-danger-bg)] text-[var(--icb-danger-fg)] ring-[var(--icb-danger-border)]',
    };
  }
  if (days === 0) {
    return {
      label: 'Due today',
      tone: 'bg-[var(--icb-warning-bg)] text-[var(--icb-warning-fg)] ring-[var(--icb-warning-border)]',
    };
  }
  if (days <= 7) {
    return {
      label: `Due in ${days} day${days === 1 ? '' : 's'}`,
      tone: 'bg-[var(--icb-warning-bg)] text-[var(--icb-warning-fg)] ring-[var(--icb-warning-border)]',
    };
  }
  return {
    label: `Due in ${days} days`,
    tone: 'bg-[var(--icb-info-bg)] text-[var(--icb-info-fg)] ring-[var(--icb-info-border)]',
  };
}
