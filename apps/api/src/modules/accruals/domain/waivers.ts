import { FEE_CODES, FEE_FREE_TIERS, type FeeCode } from '../accruals.constants.js';

/**
 * Waiver rules — the reasons a computed fee is recorded but not taken.
 *
 * A waived fee is never silently dropped: the charge row is written with the reason, so the
 * bank can show the customer what they were spared and can count the income it gave up.
 * Rules are ordered by how deliberate they are — a contractual tier waiver beats an
 * affordability waiver — and the first match wins.
 *
 * Pure functions; the caller assembles the context from the books.
 */

export interface WaiverContext {
  /** The customer's package tier, when known. */
  readonly customerTier: string | null;
  /** Ledger balance of the account being charged. */
  readonly balanceMinorUnits: number;
  /** The balance that waives the maintenance fee, when the product sets one. */
  readonly minimumBalanceMinorUnits: number | null;
  /** Ledger less holds plus arranged overdraft — what a debit could actually take. */
  readonly availableMinorUnits: number;
}

/** Fee types the minimum-balance rule applies to. */
const BALANCE_WAIVED_CODES: readonly FeeCode[] = [FEE_CODES.maintenance];

/**
 * The reason a fee is waived, or null when it should be charged.
 *
 *  1. Tier waiver — the customer's package includes fee-free banking.
 *  2. Minimum balance — the account held what the product asks, so maintenance is waived.
 *  3. Affordability — taking the fee would push the account past its arranged limit. The
 *     charge is recorded, not forced: manufacturing unauthorised overdraft to collect a fee
 *     is how banks generate complaints, and it would break the ledger's overdraft invariant.
 */
export function waiverReason(
  code: FeeCode,
  amountMinorUnits: number,
  context: WaiverContext,
): string | null {
  if (amountMinorUnits <= 0) {
    return 'Nothing to charge';
  }
  if (context.customerTier !== null && FEE_FREE_TIERS.includes(context.customerTier)) {
    return `Fee waived for ${context.customerTier} tier`;
  }
  if (
    BALANCE_WAIVED_CODES.includes(code) &&
    context.minimumBalanceMinorUnits !== null &&
    context.balanceMinorUnits >= context.minimumBalanceMinorUnits
  ) {
    return 'Minimum balance maintained';
  }
  if (amountMinorUnits > context.availableMinorUnits) {
    return 'Insufficient available balance';
  }
  return null;
}

/**
 * The base an overdraft fee may be computed on: the overdrawn amount, capped at the arranged
 * facility. Zero means no charge — an account with no arranged facility is a collections
 * matter, not a fee matter.
 */
export function chargeableOverdraftBase(
  overdrawnMinorUnits: number,
  arrangedLimitMinorUnits: number,
): number {
  if (overdrawnMinorUnits <= 0 || arrangedLimitMinorUnits <= 0) {
    return 0;
  }
  return Math.min(overdrawnMinorUnits, arrangedLimitMinorUnits);
}
