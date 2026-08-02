import {
  transferDestinationSchema,
  type Beneficiary,
  type BeneficiaryVerification,
} from '@icb/contracts';

import { toVerificationState } from '../domain/verification-state.js';
import type { BeneficiaryDoc } from './beneficiary.schemas.js';

/**
 * Persistence → contract.
 *
 * The stored destination is re-parsed rather than cast: it is the one field written as a free
 * shape, and parsing it here means a malformed document fails loudly at the boundary instead of
 * being handed to a rail that trusts it.
 *
 * Note what never crosses: `verificationHash`, `icbAccountId`, `destinationKey`. They are
 * internal machinery and a client that could read them could game the verification.
 */
export function toBeneficiary(doc: BeneficiaryDoc): Beneficiary {
  return {
    id: doc._id,
    nickname: doc.nickname,
    name: doc.name,
    destination: transferDestinationSchema.parse(doc.destination),
    displayIdentifier: doc.displayIdentifier,
    bankName: doc.bankName,
    currency: doc.currency,
    verified: doc.verified,
    favourite: doc.favourite,
    coolingOffUntil: doc.coolingOffUntil.toISOString(),
    lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
    useCount: doc.useCount,
    createdAt: doc.addedAt.toISOString(),
  };
}

export function toBeneficiaryVerification(doc: BeneficiaryDoc): BeneficiaryVerification {
  return {
    beneficiaryId: doc._id,
    state: toVerificationState(doc.verificationState),
    attemptsRemaining: Math.max(0, doc.verificationAttemptsRemaining),
    depositsSentAt: doc.depositsSentAt?.toISOString() ?? null,
    verifiedAt: doc.verifiedAt?.toISOString() ?? null,
  };
}
