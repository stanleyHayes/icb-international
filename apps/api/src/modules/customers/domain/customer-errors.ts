import type { CustomerStatus, KycStatus } from '@icb/contracts';

import { DomainError } from '../../../common/errors/index.js';

/**
 * Customer lifecycle failures.
 *
 * The closed `ErrorCode` set is a contract (adding one goes through SDK-01), so these reuse the
 * existing codes: an impossible transition is a CONFLICT, and activating without an approved KYC
 * case is KYC_REQUIRED. The classes exist so the catch site and the logs get a named failure,
 * not a reworded string.
 */

/** The status machine has no edge between the two states (or the customer is already closed). */
export class InvalidCustomerTransitionError extends DomainError {
  constructor(from: CustomerStatus, to: CustomerStatus) {
    super('CONFLICT', `A customer cannot move from ${from} to ${to}`, {
      context: { from, to },
    });
  }
}

/** Activation requires identity verification to be complete — the one guarded edge. */
export class CustomerKycIncompleteError extends DomainError {
  constructor(kycStatus: KycStatus) {
    super(
      'KYC_REQUIRED',
      'Identity verification must be approved before this customer can be activated',
      { context: { kycStatus } },
    );
  }
}

/** A closed relationship is read-only: no profile edits, no further transitions. */
export class CustomerClosedError extends DomainError {
  constructor(customerId: string) {
    super('CONFLICT', 'This customer relationship is closed and cannot be changed', {
      context: { customerId },
    });
  }
}
