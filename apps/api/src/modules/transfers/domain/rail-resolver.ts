import type { TransferDestination, TransferRail } from '@icb/contracts';

import { ValidationError } from '../../../common/errors/index.js';

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
      // A saved beneficiary carries its own destination; resolved before this point.
      return 'ach';
  }
}

/** Which rails may serve a destination — an explicit rail choice must still make sense. */
export function compatibleRails(destination: TransferDestination): readonly TransferRail[] {
  switch (destination.kind) {
    case 'own_account':
      return ['internal'];
    case 'icb_customer':
      return ['on_us'];
    case 'domestic_bank':
      return ['ach', 'wire'];
    case 'international':
      return ['swift'];
    case 'beneficiary':
      return ['ach'];
  }
}

/** Reject an explicit rail choice that cannot serve the destination. */
export function assertRailCompatible(rail: TransferRail, destination: TransferDestination): void {
  const allowed = compatibleRails(destination);
  if (!allowed.includes(rail)) {
    throw new ValidationError(`The ${rail} rail cannot serve this destination`, [
      { path: 'rail', message: `Allowed rails: ${allowed.join(', ')}` },
    ]);
  }
}
