import { cn } from '../lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'pending';

/**
 * One status vocabulary for the whole product.
 *
 * Every status enum in @icb/contracts maps here, so "completed" is the same green in the client
 * dashboard and the admin console, and an unmapped status degrades to neutral rather than
 * throwing.
 */
const TONES: Record<string, Tone> = {
  active: 'success', completed: 'success', posted: 'success', settled: 'success',
  approved: 'success', verified: 'success', paid: 'success', resolved: 'success',
  pending: 'pending', processing: 'pending', in_settlement: 'pending', scheduled: 'pending',
  initiated: 'pending', authorised: 'pending', pending_auth: 'pending', pending_review: 'pending',
  pending_kyc: 'pending', in_progress: 'pending', under_review: 'pending', investigating: 'pending',
  submitted: 'info', quoted: 'info', draft: 'neutral', issued: 'info', offered: 'info',
  frozen: 'warning', dormant: 'warning', in_arrears: 'warning', more_info_required: 'warning',
  awaiting_customer: 'warning', overdue: 'warning', challenge: 'warning', review: 'warning',
  failed: 'danger', declined: 'danger', rejected: 'danger', blocked: 'danger',
  cancelled: 'neutral', closed: 'neutral', expired: 'neutral', reversed: 'neutral',
  returned: 'danger', lost: 'danger', stolen: 'danger', written_off: 'danger',
};

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-[var(--icb-slate-100)] text-[var(--icb-slate-700)] ring-[var(--icb-slate-200)]',
  success: 'bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)] ring-[var(--icb-success-border)]',
  warning: 'bg-[var(--icb-warning-bg)] text-[var(--icb-warning-fg)] ring-[var(--icb-warning-border)]',
  danger: 'bg-[var(--icb-danger-bg)] text-[var(--icb-danger-fg)] ring-[var(--icb-danger-border)]',
  info: 'bg-[var(--icb-info-bg)] text-[var(--icb-info-fg)] ring-[var(--icb-info-border)]',
  pending: 'bg-[var(--icb-gold-50)] text-[var(--icb-gold-700)] ring-[var(--icb-gold-200)]',
};

export function StatusBadge({ status, className }: Readonly<{ status: string; className?: string }>) {
  const tone = TONES[status] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
