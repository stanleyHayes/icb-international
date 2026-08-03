import type { TransferRail } from '@icb/contracts';
import { getMinorUnitFactor, type CurrencyCode, type Money } from '@icb/money';

import { RAIL_FEE_MAJOR_UNITS } from './transfers.constants.js';

export interface FeeLine {
  readonly code: string;
  readonly label: string;
  readonly amount: Money;
}

const FEE_LABELS: Readonly<Record<TransferRail, string>> = {
  internal: 'Internal transfer fee',
  on_us: 'ICB transfer fee',
  ach: 'ACH transfer fee',
  wire: 'Wire transfer fee',
  swift: 'International transfer fee',
};

/**
 * What a rail costs.
 *
 * Fees are flat per rail and denominated in the debit currency — the customer sees one number
 * before they confirm, and the posting credits exactly that to fee income (4000). A free rail
 * yields an empty breakdown rather than a zero line, because a zero fee on a receipt reads as a
 * waived charge, which it is not.
 */
export function feesFor(rail: TransferRail, currency: CurrencyCode): FeeLine[] {
  const major = RAIL_FEE_MAJOR_UNITS[rail];
  if (major === 0) {
    return [];
  }
  return [
    {
      code: `${rail.toUpperCase()}_FEE`,
      label: FEE_LABELS[rail],
      amount: {
        minorUnits: major * getMinorUnitFactor(currency),
        currency,
      },
    },
  ];
}

/** Sum of a fee breakdown. Zero for a free rail. */
export function totalFees(fees: readonly FeeLine[], currency: CurrencyCode): Money {
  return {
    minorUnits: fees.reduce((total, fee) => total + fee.amount.minorUnits, 0),
    currency,
  };
}
