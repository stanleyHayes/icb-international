export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'pending';

/**
 * One status vocabulary for the whole product.
 *
 * Every status enum in @icb/contracts maps here — customer, KYC, account, transaction, transfer,
 * card, loan, case, dispute, notification, payment, savings, support, approval, verification,
 * and health statuses — so "completed" is the same green in the client dashboard and the admin
 * console. The audit test in `__tests__/status-badge.test.tsx` asserts this map stays exhaustive
 * as the contract grows; an unmapped status degrades to neutral rather than throwing.
 */
export const STATUS_TONES: Readonly<Record<string, StatusTone>> = {
  // success — terminal good states
  active: 'success',
  approved: 'success',
  completed: 'success',
  verified: 'success',
  paid: 'success',
  resolved: 'success',
  settled: 'success',
  posted: 'success',
  delivered: 'success',
  captured: 'success',
  accepted: 'success',
  upheld: 'success',
  achieved: 'success',
  matured: 'success',
  healthy: 'success',
  sent: 'success',
  issued: 'success',
  allow: 'success',
  // pending — in flight, expected to progress
  pending: 'pending',
  pending_auth: 'pending',
  pending_approval: 'pending',
  pending_kyc: 'pending',
  pending_review: 'pending',
  initiated: 'pending',
  authorised: 'pending',
  processing: 'pending',
  in_settlement: 'pending',
  in_progress: 'pending',
  scheduled: 'pending',
  queued: 'pending',
  running: 'pending',
  uploaded: 'pending',
  deposits_sent: 'pending',
  // info — active but awaiting input or a routine stage
  submitted: 'info',
  quoted: 'info',
  offered: 'info',
  prospect: 'info',
  not_started: 'info',
  investigating: 'info',
  provisional_credit: 'info',
  representment: 'info',
  arbitration: 'info',
  // warning — needs attention before it becomes a problem
  frozen: 'warning',
  dormant: 'warning',
  in_arrears: 'warning',
  more_info_required: 'warning',
  awaiting_customer: 'warning',
  awaiting_agent: 'warning',
  overdue: 'warning',
  due: 'warning',
  partially_paid: 'warning',
  challenge: 'warning',
  review: 'warning',
  under_review: 'warning',
  degraded: 'warning',
  paused: 'warning',
  open: 'warning',
  escalated: 'warning',
  // danger — terminal bad states and hard stops
  failed: 'danger',
  declined: 'danger',
  rejected: 'danger',
  returned: 'danger',
  lost: 'danger',
  stolen: 'danger',
  written_off: 'danger',
  bounced: 'danger',
  complained: 'danger',
  down: 'danger',
  block: 'danger',
  locked: 'danger',
  // neutral — inactive, closed, or merely informational
  draft: 'neutral',
  cancelled: 'neutral',
  closed: 'neutral',
  expired: 'neutral',
  reversed: 'neutral',
  refunded: 'neutral',
  withdrawn: 'neutral',
  partial: 'neutral',
  dismissed: 'neutral',
  suspended: 'neutral',
  suppressed: 'neutral',
  requested: 'neutral',
  broken: 'neutral',
};

export const DEFAULT_STATUS_TONE: StatusTone = 'neutral';

export const STATUS_TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  neutral: 'bg-[var(--icb-slate-100)] text-[var(--icb-slate-700)] ring-[var(--icb-slate-200)]',
  success: 'bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)] ring-[var(--icb-success-border)]',
  warning: 'bg-[var(--icb-warning-bg)] text-[var(--icb-warning-fg)] ring-[var(--icb-warning-border)]',
  danger: 'bg-[var(--icb-danger-bg)] text-[var(--icb-danger-fg)] ring-[var(--icb-danger-border)]',
  info: 'bg-[var(--icb-info-bg)] text-[var(--icb-info-fg)] ring-[var(--icb-info-border)]',
  pending: 'bg-[var(--icb-gold-50)] text-[var(--icb-gold-700)] ring-[var(--icb-gold-200)]',
};

/** Tone for a status string; unknown statuses render neutral rather than failing. */
export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? DEFAULT_STATUS_TONE;
}

/** Human-readable label: `pending_kyc` → `Pending kyc`. */
export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}
