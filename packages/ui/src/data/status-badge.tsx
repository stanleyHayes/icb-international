import { cn } from '../lib/cn';
import { STATUS_TONE_CLASSES, statusLabel, statusTone } from './status-badge.constants';

export type StatusBadgeProps = Readonly<{
  /** Any status string from @icb/contracts; unknown values render neutral. */
  status: string;
  className?: string;
}>;

/**
 * A status pill.
 *
 * The tone map lives in `status-badge.constants.ts` and covers every status enum in
 * @icb/contracts, so the same status reads identically in the client dashboard and the admin
 * console. The label is derived from the status itself — colour is never the only signal.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize',
        STATUS_TONE_CLASSES[statusTone(status)],
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
