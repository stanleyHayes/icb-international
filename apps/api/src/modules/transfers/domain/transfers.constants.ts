import type { TransferRail, TransferStatus } from '@icb/contracts';

/**
 * Transfer module literals.
 *
 * Everything a reviewer would otherwise have to hunt for — caps, fees, cut-offs, event names —
 * lives here so the pipeline reads as policy, not as a pile of numbers.
 */

/** Settlement lag in business days, by rail. Same-day rails still honour their cut-off. */
export const RAIL_SETTLEMENT_DAYS: Readonly<Record<TransferRail, number>> = {
  internal: 0,
  on_us: 0,
  ach: 1,
  wire: 0,
  swift: 2,
};

/** UTC cut-off after which a rail rolls to the next business day. Null means no cut-off. */
export const RAIL_CUT_OFF: Readonly<Record<TransferRail, string | null>> = {
  internal: null,
  on_us: null,
  ach: '15:00',
  wire: '16:00',
  swift: '14:00',
};

/** Flat rail fee in major units of the debit currency, converted at use time. */
export const RAIL_FEE_MAJOR_UNITS: Readonly<Record<TransferRail, number>> = {
  internal: 0,
  on_us: 0,
  ach: 0,
  wire: 25,
  swift: 35,
};

/** Per-transaction cap in major units of the debit currency, by rail. */
export const RAIL_PER_TRANSACTION_CAP: Readonly<Record<TransferRail, number>> = {
  internal: 1_000_000,
  on_us: 250_000,
  ach: 50_000,
  wire: 500_000,
  swift: 250_000,
};

/** Rolling one-business-day debit cap per customer, in major units of the debit currency. */
export const DAILY_DEBIT_CAP_MAJOR_UNITS: Readonly<Record<TransferRail, number>> = {
  internal: 2_000_000,
  on_us: 500_000,
  ach: 100_000,
  wire: 1_000_000,
  swift: 500_000,
};

/** Above this a quote flags `requiresApproval` for maker-checker review. */
export const APPROVAL_THRESHOLD_MAJOR_UNITS = 100_000;

/** How long a transfer quote stays redeemable. */
export const TRANSFER_QUOTE_TTL_SECONDS = 300;
const MS_PER_SECOND = 1000;
export const TRANSFER_QUOTE_TTL_MS = TRANSFER_QUOTE_TTL_SECONDS * MS_PER_SECOND;

/** Statuses from which a customer cancel is allowed — anything already moving is final. */
export const CANCELLABLE_STATUSES: readonly TransferStatus[] = ['scheduled', 'pending_approval'];

/** Outbox event names. Notifications subscribes by these keys. */
export const TRANSFER_EVENTS = {
  sent: 'transfer_sent',
  failed: 'transfer_failed',
  due: 'transfer_due',
} as const;

/** Consumer name this module registers on the outbox for due-transfer execution. */
export const DUE_TRANSFER_CONSUMER = 'transfers.due-executor';

/** Bulk upload guard rails, mirrored by the contract's `rows` bound. */
export const BULK_MAX_ROWS = 500;

/** The hour (UTC) scheduled transfers execute at on their due date. */
export const SCHEDULED_EXECUTION_HOUR_UTC = 9;
