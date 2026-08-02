import type { TransferDestination, TransferRail } from '@icb/contracts';

/**
 * Which rail a destination implies.
 *
 * The customer picks a recipient, not a payment network — asking them to choose between ACH and
 * SWIFT is asking them to know something a bank should determine. The rail is derived here and
 * shown back to them, with its cost and arrival time, before they confirm.
 */
export function resolveRail(destination: TransferDestination): TransferRail {
  switch (destination.kind) {
    case 'own_account':
      return 'internal';
    case 'icb_customer':
      return 'on_us';
    case 'domestic_bank':
      return 'ach';
    case 'international':
      return 'swift';
    case 'beneficiary':
      // A saved beneficiary carries its own destination; the caller resolves it before this point.
      return 'ach';
  }
}

/** Settlement lag in business days, by rail. */
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
