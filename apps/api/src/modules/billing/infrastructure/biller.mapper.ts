import type { Biller, BillerCategory } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { BillerDoc } from './biller.schemas.js';

/**
 * Persistence → contract.
 *
 * Note what does not cross this boundary: `failureRate`, `typicalBillMinorUnits`, and
 * `feeMinorUnits`. The first two are simulation internals that would give the game away, and the
 * fee belongs on the payment the customer is actually charged for, not on the directory listing.
 */
export function toBiller(biller: BillerDoc): Biller {
  return {
    id: biller._id,
    name: biller.name,
    category: biller.category as BillerCategory,
    logoUrl: biller.logoUrl,
    referenceLabel: biller.referenceLabel,
    referencePattern: biller.referencePattern,
    supportsBalanceEnquiry: biller.supportsBalanceEnquiry,
    minimumAmount:
      biller.minimumAmountMinorUnits === null
        ? null
        : toMoneyDto(biller.minimumAmountMinorUnits, biller.currency),
    active: biller.active,
  };
}
