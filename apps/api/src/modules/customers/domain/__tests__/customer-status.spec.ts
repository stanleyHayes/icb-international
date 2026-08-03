import { describe, expect, it } from 'vitest';

import {
  CustomerKycIncompleteError,
  InvalidCustomerTransitionError,
} from '../customer-errors.js';
import { assertTransitionAllowed, canTransition } from '../customer-status.js';

describe('canTransition', () => {
  it.each([
    ['prospect', 'pending_kyc'],
    ['prospect', 'closed'],
    ['pending_kyc', 'active'],
    ['pending_kyc', 'suspended'],
    ['pending_kyc', 'closed'],
    ['active', 'dormant'],
    ['active', 'suspended'],
    ['active', 'closed'],
    ['dormant', 'active'],
    ['dormant', 'suspended'],
    ['dormant', 'closed'],
    ['suspended', 'active'],
    ['suspended', 'closed'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['prospect', 'active'],
    ['prospect', 'dormant'],
    ['prospect', 'suspended'],
    ['pending_kyc', 'prospect'],
    ['pending_kyc', 'dormant'],
    ['active', 'prospect'],
    ['active', 'pending_kyc'],
    ['dormant', 'pending_kyc'],
    ['suspended', 'dormant'],
    ['closed', 'active'],
    ['closed', 'suspended'],
    ['active', 'active'],
  ] as const)('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('treats closed as terminal in every direction', () => {
    const exits = ['prospect', 'pending_kyc', 'active', 'dormant', 'suspended', 'closed'] as const;
    for (const target of exits) {
      expect(canTransition('closed', target)).toBe(false);
    }
  });
});

describe('assertTransitionAllowed', () => {
  it('throws the typed transition error for a missing edge', () => {
    expect(() =>
      assertTransitionAllowed({ from: 'dormant', to: 'pending_kyc', kycStatus: 'approved' }),
    ).toThrow(InvalidCustomerTransitionError);
  });

  it('blocks activation from pending_kyc until KYC is approved', () => {
    expect(() =>
      assertTransitionAllowed({ from: 'pending_kyc', to: 'active', kycStatus: 'pending_review' }),
    ).toThrow(CustomerKycIncompleteError);
  });

  it('allows activation from pending_kyc once KYC is approved', () => {
    expect(() =>
      assertTransitionAllowed({ from: 'pending_kyc', to: 'active', kycStatus: 'approved' }),
    ).not.toThrow();
  });

  it('does not re-check KYC when reactivating a dormant or suspended customer', () => {
    expect(() =>
      assertTransitionAllowed({ from: 'dormant', to: 'active', kycStatus: 'expired' }),
    ).not.toThrow();
    expect(() =>
      assertTransitionAllowed({ from: 'suspended', to: 'active', kycStatus: 'approved' }),
    ).not.toThrow();
  });

  it('allows closing from any open status without a KYC check', () => {
    expect(() =>
      assertTransitionAllowed({ from: 'pending_kyc', to: 'closed', kycStatus: 'not_started' }),
    ).not.toThrow();
  });
});
