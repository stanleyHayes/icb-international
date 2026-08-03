import type { CustomerStatus, KycStatus } from '@icb/contracts';

import {
  CustomerKycIncompleteError,
  InvalidCustomerTransitionError,
} from './customer-errors.js';

/**
 * The customer lifecycle.
 *
 *   prospect ──▶ pending_kyc ──▶ active ──▶ dormant
 *       │             │            │  ▲        │
 *       ▼             ▼            ▼  │        ▼
 *     closed ◀── suspended ◀──────────┴────── (any)
 *
 * Two states deserve the guards they carry:
 *  - `active` is the only status that lets money move, so entering it from `pending_kyc`
 *    requires an approved KYC case. Re-entry from `dormant`/`suspended` skips that check —
 *    the customer was verified once; suspension is a staff decision, not a re-onboarding.
 *  - `closed` is terminal. A bank never resurrects a closed relationship; a returning
 *    customer opens a new one.
 *
 * `prospect` exists for pre-onboarding leads created by staff or campaigns; a prospect that
 * never starts onboarding is closed, never suspended.
 */
const TRANSITIONS: Readonly<Record<CustomerStatus, readonly CustomerStatus[]>> = {
  prospect: ['pending_kyc', 'closed'],
  pending_kyc: ['active', 'suspended', 'closed'],
  active: ['dormant', 'suspended', 'closed'],
  dormant: ['active', 'suspended', 'closed'],
  suspended: ['active', 'closed'],
  closed: [],
};

const KYC_APPROVED: KycStatus = 'approved';

export interface TransitionCheck {
  readonly from: CustomerStatus;
  readonly to: CustomerStatus;
  readonly kycStatus: KycStatus;
}

/** Whether the graph has an edge, ignoring state-dependent guards. */
export function canTransition(from: CustomerStatus, to: CustomerStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Throws the typed error for the first rule the transition breaks. */
export function assertTransitionAllowed(check: TransitionCheck): void {
  if (!canTransition(check.from, check.to)) {
    throw new InvalidCustomerTransitionError(check.from, check.to);
  }
  if (check.to === 'active' && check.from === 'pending_kyc' && check.kycStatus !== KYC_APPROVED) {
    throw new CustomerKycIncompleteError(check.kycStatus);
  }
}
