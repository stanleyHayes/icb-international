import type { DisputeReason } from '@icb/contracts';

/**
 * Investigation deadlines.
 *
 * Unauthorised-use claims run to the tightest clock because that is where the customer is out of
 * pocket through no act of their own; merchandise disputes get longer because they genuinely
 * require the merchant to respond. The queue sorts on the resulting deadline, so these numbers
 * decide what an analyst sees first every morning.
 */
const SLA_BUSINESS_DAYS: Readonly<Record<DisputeReason, number>> = {
  unauthorised: 10,
  atm_no_cash: 10,
  duplicate_charge: 15,
  incorrect_amount: 15,
  credit_not_processed: 20,
  cancelled_recurring: 20,
  goods_not_received: 30,
  goods_not_as_described: 30,
  other: 20,
};

export function slaBusinessDaysFor(reason: DisputeReason): number {
  return SLA_BUSINESS_DAYS[reason];
}

/**
 * Whether a reason qualifies for provisional credit while the bank investigates.
 *
 * The customer should not fund the bank's investigation of a charge they did not make. Goods
 * disputes are different: the customer chose to transact, and the merchant is entitled to answer
 * before the money is taken back.
 */
const PROVISIONAL_CREDIT_ELIGIBLE: readonly DisputeReason[] = [
  'unauthorised',
  'duplicate_charge',
  'incorrect_amount',
  'atm_no_cash',
  'cancelled_recurring',
];

export function qualifiesForProvisionalCredit(reason: DisputeReason): boolean {
  return PROVISIONAL_CREDIT_ELIGIBLE.includes(reason);
}
