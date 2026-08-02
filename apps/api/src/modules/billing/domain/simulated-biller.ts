import { intBetween, pickStable, stableReference, unitInterval } from './deterministic.js';

/**
 * The biller on the other end of the wire.
 *
 * ICB does not talk to a real utility, so this module *is* the counterparty: it decides what a
 * balance enquiry returns and whether a payment is accepted. Keeping both behaviours here — rather
 * than sprinkling `if (random < 0.02)` through the service — means the simulation has one seam,
 * and a test can reason about it without a database.
 */

/** The biller fields the simulation reads. Structural, so the Mongoose document stays private. */
export interface SimulatedBiller {
  readonly code: string;
  readonly supportsBalanceEnquiry: boolean;
  readonly typicalBillMinorUnits: number;
  readonly minimumAmountMinorUnits: number | null;
  readonly failureRate: number;
}

export interface BalanceEnquiry {
  readonly outstandingMinorUnits: number;
  /** ISO calendar date the biller expects payment by. */
  readonly dueOn: string;
  /** The `YYYY-MM` billing cycle the figures belong to. */
  readonly cycle: string;
}

const ENQUIRY_SALT = 'icb.bill.enquiry';
const OUTCOME_SALT = 'icb.bill.outcome';

/** Bills fall due mid-to-late month, never on a day that some months do not have. */
const FIRST_DUE_DAY = 12;
const LAST_DUE_DAY = 25;

/** A flat "typical" amount every month reads as fake immediately, so the figure varies. */
const MIN_FACTOR = 0.65;
const FACTOR_SPREAD = 0.85;
/** Billers quote round-ish figures; sub-unit precision on a utility bill is a tell. */
const ROUNDING_STEP = 10;

/**
 * What the biller says is owed this cycle.
 *
 * Derived from the biller, the customer's reference, and the cycle, so the same enquiry repeated
 * within a month returns the same answer, and the figure moves when the month turns over.
 * Returns `null` for prepaid and pay-what-you-owe billers, which publish no balance at all.
 */
export function enquireBalance(
  biller: SimulatedBiller,
  customerReference: string,
  cycle: string,
): BalanceEnquiry | null {
  if (!biller.supportsBalanceEnquiry) {
    return null;
  }

  const factor = MIN_FACTOR + unitInterval(ENQUIRY_SALT, biller.code, customerReference, cycle) * FACTOR_SPREAD;
  const rounded = Math.round((biller.typicalBillMinorUnits * factor) / ROUNDING_STEP) * ROUNDING_STEP;
  const day = intBetween(FIRST_DUE_DAY, LAST_DUE_DAY, ENQUIRY_SALT, biller.code, customerReference, cycle);

  return {
    outstandingMinorUnits: Math.max(rounded, biller.minimumAmountMinorUnits ?? 0),
    dueOn: `${cycle}-${String(day).padStart(2, '0')}`,
    cycle,
  };
}

/**
 * The reasons a biller actually gives. Vague enough to be honest — ICB does not know why the
 * other side said no — but specific enough that support can act on them.
 */
const FAILURE_REASONS = [
  'The biller rejected the payment',
  'The biller does not recognise this reference',
  "The biller's system was unavailable",
  'The biller returned the payment as a duplicate',
] as const;

export interface BillerOutcome {
  readonly failed: boolean;
  readonly failureReason: string | null;
  /** The biller's own confirmation identifier. Null when the payment was rejected. */
  readonly billerReference: string | null;
}

/**
 * Whether the biller accepted the payment ICB has already debited for.
 *
 * This is the case that matters: the money left the customer, and the counterparty then said no.
 * The caller must reverse the posting rather than quietly keep the funds — which is why this
 * returns a decision instead of throwing.
 */
export function decideOutcome(biller: SimulatedBiller, paymentId: string): BillerOutcome {
  const roll = unitInterval(OUTCOME_SALT, biller.code, paymentId);

  if (roll < biller.failureRate) {
    return {
      failed: true,
      failureReason: pickStable(FAILURE_REASONS, OUTCOME_SALT, paymentId, 'reason'),
      billerReference: null,
    };
  }

  return {
    failed: false,
    failureReason: null,
    billerReference: billerReferenceFor(biller.code, paymentId),
  };
}

/** `NATIONAL_GRID_POSTPAID` + a payment id becomes something like `NGP-4F2K8M1Q`. */
function billerReferenceFor(billerCode: string, paymentId: string): string {
  const initials = billerCode
    .split('_')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 3);

  return stableReference(initials.length > 0 ? initials : 'BLR', billerCode, paymentId);
}
