import { STATUS_TONE_CLASSES, cn, type StatusTone } from '@icb/ui';

const SEVERITY_TONES: Readonly<Record<string, StatusTone>> = {
  low: 'neutral',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

/**
 * An alert-severity pill.
 *
 * Severity is not part of the shared status vocabulary, so it maps onto the same tone classes
 * here rather than through `StatusBadge` — one visual language, no second palette.
 */
export function SeverityBadge({ severity }: Readonly<{ severity: string }>) {
  const tone = SEVERITY_TONES[severity] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize',
        STATUS_TONE_CLASSES[tone],
        severity === 'critical' && 'font-bold',
      )}
    >
      {severity}
    </span>
  );
}
