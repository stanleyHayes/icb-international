import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';

export const MEMBER_SINCE = new Date('2024-03-01T00:00:00.000Z');
export const KYC_VERIFIED_AT = new Date('2024-03-02T12:00:00.000Z');

/** A persisted customer row, as returned by `.lean()`. */
export function makeCustomerDoc(overrides: Partial<CustomerDoc> = {}): CustomerDoc {
  return {
    _id: 'cust-1',
    type: 'individual',
    status: 'active',
    statusHistory: [],
    tier: 'standard',
    email: 'ada@example.com',
    phone: '+15551234567',
    individual: { firstName: 'Ada', lastName: 'Lovelace' },
    business: null,
    residentialAddress: null,
    postalAddress: null,
    avatar: null,
    preferences: { channels: { email: true } },
    kycLevel: 'full',
    kycStatus: 'verified',
    kycVerifiedAt: KYC_VERIFIED_AT,
    kycNextReviewAt: null,
    riskRating: 'low',
    flags: [],
    relationshipManager: null,
    memberSince: MEMBER_SINCE,
    lastActivityAt: null,
    ...overrides,
  };
}
