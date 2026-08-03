import type { Hold } from '@icb/contracts';

import type { HoldDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { toMoneyDto } from './account.mapper.js';

/** Persistence → contract for an authorisation hold. */
export function toHoldDto(hold: HoldDoc): Hold {
  return {
    id: hold._id,
    accountId: hold.accountRef.slice('acct:'.length),
    amount: toMoneyDto(hold.minorUnits, hold.currency),
    reason: hold.reason,
    sourceReference: hold.sourceId,
    placedAt: hold.placedAt.toISOString(),
    expiresAt: hold.expiresAt.toISOString(),
    releasedAt: hold.releasedAt?.toISOString() ?? null,
  };
}
