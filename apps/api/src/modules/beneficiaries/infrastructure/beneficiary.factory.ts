import type { CreateBeneficiaryRequest } from '@icb/contracts';

import { newId } from '../../../infrastructure/database/identifier.js';
import type { BeneficiaryTarget } from '../application/beneficiary-target.resolver.js';
import { coolingOffEndsAt } from '../domain/cooling-off.js';
import { MICRO_DEPOSIT_ATTEMPTS } from '../domain/micro-deposit.js';
import { VERIFICATION_STATES } from '../domain/verification-state.js';
import type { BeneficiaryDoc } from './beneficiary.schemas.js';

export interface NewBeneficiary {
  readonly customerId: string;
  readonly request: CreateBeneficiaryRequest;
  readonly key: string;
  readonly target: BeneficiaryTarget;
  readonly addedAt: Date;
}

/**
 * The initial state of a saved payee.
 *
 * A new payee always starts unverified, with a full attempt budget and a cooling-off clock that
 * starts now. None of those are the caller's decision — which is why they are written here from
 * the clock and the resolver, and never read off the request.
 */
export function buildBeneficiaryDocument(input: NewBeneficiary): BeneficiaryDoc {
  const { customerId, request, key, target, addedAt } = input;
  return {
    _id: newId(),
    customerId,
    nickname: request.nickname ?? null,
    name: request.name,
    destination: { ...request.destination },
    destinationKey: key,
    displayIdentifier: target.displayIdentifier,
    bankName: target.bankName,
    currency: target.currency,
    icbAccountId: target.icbAccountId,
    verified: false,
    favourite: request.favourite,
    coolingOffUntil: coolingOffEndsAt(addedAt),
    lastUsedAt: null,
    useCount: 0,
    addedAt,
    verificationState: VERIFICATION_STATES.NOT_STARTED,
    verificationAttemptsRemaining: MICRO_DEPOSIT_ATTEMPTS,
    verificationHash: null,
    depositsSentAt: null,
    verifiedAt: null,
    microDepositTransactionIds: [],
  };
}
