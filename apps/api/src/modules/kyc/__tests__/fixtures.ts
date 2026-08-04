import { vi } from 'vitest';

import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { KycCaseDoc, KycDocumentSub } from '../infrastructure/kyc.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const SLA_MS = 48 * 60 * 60 * 1000;
export const CASE_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9K1';
export const CUSTOMER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9K2';

export const ASSET = {
  provider: 'cloudinary',
  publicId: 'icb/kyc/cust/passport-a1b2',
  resourceType: 'image',
  format: 'png',
  bytes: 12_345,
  uploadedAt: NOW.toISOString(),
} as const;

/** One attached document, as stored inside a case; tests override what they exercise. */
export function kycDocumentSub(overrides: Partial<KycDocumentSub> = {}): KycDocumentSub {
  return {
    id: 'doc-1',
    type: 'passport',
    asset: ASSET,
    status: 'uploaded',
    rejectionReason: null,
    documentNumber: 'P1234567',
    issuingCountry: 'GH',
    expiresOn: '2030-01-01',
    uploadedAt: NOW,
    reviewedAt: null,
    ...overrides,
  };
}

/** An open (in-progress) tier-1 case; tests override the fields they exercise. */
export function kycCaseDoc(overrides: Partial<KycCaseDoc> = {}): KycCaseDoc {
  return {
    _id: CASE_ID,
    customerId: CUSTOMER_ID,
    customerName: 'Ada Lovelace',
    customerType: 'individual',
    requestedLevel: 'tier_1',
    status: 'in_progress',
    documents: [],
    checks: [],
    riskRating: null,
    decision: null,
    slaDueAt: new Date(NOW.getTime() + SLA_MS),
    submittedAt: null,
    assignedTo: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** An individual customer with a displayable name; tests override the fields they exercise. */
export function customerDoc(overrides: Partial<CustomerDoc> = {}): CustomerDoc {
  return {
    _id: CUSTOMER_ID,
    type: 'individual',
    status: 'active',
    statusHistory: [],
    tier: 'standard',
    email: 'ada@example.com',
    phone: '+233200000000',
    individual: { firstName: 'Ada', lastName: 'Lovelace' },
    business: null,
    residentialAddress: null,
    postalAddress: null,
    avatar: null,
    preferences: {},
    kycLevel: null,
    kycStatus: 'not_started',
    kycVerifiedAt: null,
    kycNextReviewAt: null,
    riskRating: 'low',
    flags: [],
    relationshipManager: null,
    memberSince: NOW,
    lastActivityAt: null,
    ...overrides,
  };
}

type ChainMock = Record<string, ReturnType<typeof vi.fn>>;

/**
 * A Mongoose query stand-in: every chaining method returns the same object, `lean` resolves.
 * Models are mocked only here — the port boundary — never deeper into the module.
 */
export function chainQuery(result: unknown): ChainMock {
  const chain: ChainMock = {};
  for (const method of ['sort', 'select', 'limit', 'skip', 'session']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain['lean'] = vi.fn().mockResolvedValue(result);
  return chain;
}
