import type { PostingActor } from '../ledger/domain/posting.types.js';

/**
 * Day-count conventions the engine prices accruals under. Which convention applies to which
 * balance is policy (domain/accrual-policy.ts), never a literal at the call site.
 */
export const DAY_COUNT_CONVENTIONS = ['ACT/365', 'ACT/360', '30/360'] as const;
export type DayCountConvention = (typeof DAY_COUNT_CONVENTIONS)[number];

export const DAYS_IN_YEAR_ACT_365 = 365;
export const DAYS_IN_YEAR_ACT_360 = 360;
/** The 30/360 convention treats every month as exactly thirty days. */
export const DAYS_IN_MONTH_30_360 = 30;
/** A 31st is pulled back to the 30th under 30/360. */
export const MAX_DAY_30_360 = 30;

/** How often accrued interest stops accruing and is posted to the customer. */
export const CAPITALISATION_SCHEDULES = ['monthly', 'quarterly', 'at_maturity'] as const;
export type CapitalisationSchedule = (typeof CAPITALISATION_SCHEDULES)[number];

/** Quarter-end calendar months for the quarterly capitalisation schedule. */
export const QUARTER_END_MONTHS: readonly number[] = [3, 6, 9, 12];

/**
 * Fee codes, shared with the `fee_charges` claim index `(accountId, period, code)`.
 * `ACCOUNT_MAINTENANCE` matches the code the end-of-day stub already writes, so a charge
 * claimed by either engine blocks the other from charging twice for the same period.
 */
export const FEE_CODES = {
  maintenance: 'ACCOUNT_MAINTENANCE',
  transaction: 'TRANSACTION',
  overdraft: 'OVERDRAFT',
  fx: 'FX_CONVERSION',
  late: 'LATE_PAYMENT',
} as const;
export type FeeCode = (typeof FEE_CODES)[keyof typeof FEE_CODES];

/** Customer tiers whose product package includes fee-free banking. */
export const FEE_FREE_TIERS: readonly string[] = ['premium', 'private'];

/** Debit transaction types that count against the free transaction allowance. */
export const CHARGEABLE_DEBIT_TYPES: readonly string[] = [
  'transfer_out',
  'card_purchase',
  'atm_withdrawal',
  'withdrawal',
];

/** Free customer debits per statement cycle before the per-item fee applies. */
export const TRANSACTION_FREE_ALLOWANCE = 10;
/** Per-item transaction fee beyond the allowance, in major units. */
export const TRANSACTION_FEE_MAJOR_UNITS = 0.5;
/** FX service fee, as a percentage of the period's conversion volume. */
export const FX_FEE_PERCENT = 0.5;
/** Flat late fee per overdue instalment, in major units. */
export const LATE_FEE_MAJOR_UNITS = 25;
/** Annual rate charged on arranged overdraft balances, accrued daily under ACT/360. */
export const OVERDRAFT_ANNUAL_RATE = 0.199;

/** Loan statuses that still have a schedule being serviced. */
export const ACTIVE_LOAN_STATUSES: readonly string[] = ['active', 'in_arrears'];

/** Actor stamped on every posting the engine makes. */
export const SYSTEM_ACTOR: PostingActor = { kind: 'system', id: null, label: 'accruals-engine' };

/** ISO calendar date shape (`YYYY-MM-DD`) every entry point validates against. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
