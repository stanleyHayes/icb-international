import type { MoneyDto } from '@icb/contracts';

import { DomainError, ValidationError } from '../../../common/errors/index.js';
import type { CardLimitsDoc } from './card-defaults.js';

/**
 * Limit merging and sanity.
 *
 * Two things go wrong when a customer edits limits and nobody checks the result. The first is a
 * currency mix-up — a limit quoted in a currency the card is not billed in would silently compare
 * integers that mean different amounts. The second is an incoherent set: a per-transaction limit
 * above the daily limit is not a stricter rule, it is a rule that can never bind, and the customer
 * would believe they had raised a ceiling that a lower limit still holds down.
 */

/** The partial limit update as it arrives from the contract's request schema. */
export interface LimitPatch {
  perTransaction?: MoneyDto;
  daily?: MoneyDto;
  monthly?: MoneyDto;
  atmDaily?: MoneyDto;
  contactless?: MoneyDto;
}

function amountOf(value: MoneyDto | undefined, fallback: number, currency: string): number {
  if (!value) {
    return fallback;
  }
  if (value.currency !== currency) {
    throw new DomainError('ACCOUNT_CURRENCY_MISMATCH', `Card limits must be set in ${currency}`, {
      context: { expected: currency, received: value.currency },
    });
  }
  return value.minorUnits;
}

/** Fields the customer did not mention keep the value they already had. */
export function mergeLimits(
  current: CardLimitsDoc,
  patch: LimitPatch,
  currency: string,
): CardLimitsDoc {
  return {
    perTransactionMinorUnits: amountOf(
      patch.perTransaction,
      current.perTransactionMinorUnits,
      currency,
    ),
    dailyMinorUnits: amountOf(patch.daily, current.dailyMinorUnits, currency),
    monthlyMinorUnits: amountOf(patch.monthly, current.monthlyMinorUnits, currency),
    atmDailyMinorUnits: amountOf(patch.atmDaily, current.atmDailyMinorUnits, currency),
    contactlessMinorUnits: amountOf(patch.contactless, current.contactlessMinorUnits, currency),
  };
}

/** Each limit must fit inside the wider one it sits under. */
const ORDERING: readonly (readonly [string, keyof CardLimitsDoc, string, keyof CardLimitsDoc])[] = [
  ['contactless', 'contactlessMinorUnits', 'per-transaction', 'perTransactionMinorUnits'],
  ['per-transaction', 'perTransactionMinorUnits', 'daily', 'dailyMinorUnits'],
  ['daily ATM', 'atmDailyMinorUnits', 'daily', 'dailyMinorUnits'],
  ['daily', 'dailyMinorUnits', 'monthly', 'monthlyMinorUnits'],
];

export function assertCoherentLimits(limits: CardLimitsDoc): void {
  for (const [lowerName, lowerKey, upperName, upperKey] of ORDERING) {
    if (limits[lowerKey] > limits[upperKey]) {
      throw new ValidationError(
        `Your ${lowerName} limit cannot be higher than your ${upperName} limit`,
        [{ path: lowerKey, message: `Must not exceed the ${upperName} limit` }],
      );
    }
  }
}
