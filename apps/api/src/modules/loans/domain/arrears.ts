import type { LoanArrears } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { daysBetweenIso } from './schedule-dates.js';

/**
 * Arrears ageing.
 *
 * A loan is not simply "late" — how late decides everything downstream: the collections queue it
 * enters, the provision the bank holds against it, and what the customer is told. The buckets
 * here are the standard 30-day bands, aged from the *oldest* unpaid instalment, because that is
 * the one that determines the severity of the delinquency.
 */

export type ArrearsBucket = LoanArrears['bucket'];

/** The minimum a schedule row must expose to be aged. */
export interface AgeableInstalment {
  readonly dueOn: string;
  /** Instalment less anything already paid against it. Zero or less means settled. */
  readonly outstandingMinorUnits: number;
}

/** Lower bound of each bucket, most severe first. */
const BUCKETS: readonly { readonly floor: number; readonly bucket: ArrearsBucket }[] = [
  { floor: 90, bucket: '90_plus' },
  { floor: 60, bucket: '60_89' },
  { floor: 30, bucket: '30_59' },
  { floor: 1, bucket: '1_29' },
  { floor: 0, bucket: 'current' },
];

export function bucketFor(daysPastDue: number): ArrearsBucket {
  return BUCKETS.find((entry) => daysPastDue >= entry.floor)?.bucket ?? 'current';
}

/**
 * Age a schedule as at `today`. Returns `null` when nothing is overdue — a loan that is merely
 * unpaid-but-not-yet-due is not in arrears, and reporting it as such would be wrong.
 */
export function ageArrears(
  instalments: readonly AgeableInstalment[],
  today: string,
  currency: CurrencyCode,
): LoanArrears | null {
  const overdue = instalments.filter(
    (instalment) =>
      instalment.outstandingMinorUnits > 0 && daysBetweenIso(instalment.dueOn, today) > 0,
  );

  if (overdue.length === 0) {
    return null;
  }

  const amount = overdue.reduce((total, instalment) => total + instalment.outstandingMinorUnits, 0);
  const daysPastDue = overdue.reduce(
    (worst, instalment) => Math.max(worst, daysBetweenIso(instalment.dueOn, today)),
    0,
  );

  return {
    amount: toMoneyDto(amount, currency),
    daysPastDue,
    bucket: bucketFor(daysPastDue),
    missedInstalments: overdue.length,
  };
}
