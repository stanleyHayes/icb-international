import { vi } from 'vitest';

import type { CustomerDoc } from '../infrastructure/customer.schemas.js';

export const NOW = new Date('2026-08-02T12:00:00.000Z');
export const CUSTOMER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T0';

/** A fully-populated individual customer; tests override the fields they exercise. */
export function customerDoc(overrides: Record<string, unknown> = {}): CustomerDoc {
  return {
    _id: CUSTOMER_ID,
    type: 'individual',
    status: 'active',
    statusHistory: [],
    tier: 'standard',
    email: 'ama@example.com',
    phone: '+233201234567',
    individual: {
      firstName: 'Ama',
      lastName: 'Mensah',
      dateOfBirth: '1990-04-12',
      nationality: 'GH',
    },
    business: null,
    residentialAddress: null,
    postalAddress: null,
    avatar: null,
    preferences: {
      locale: 'en',
      timezone: 'UTC',
      marketingEmail: false,
      marketingSms: false,
      statementDelivery: 'both',
    },
    kycLevel: 'tier_2',
    kycStatus: 'approved',
    kycVerifiedAt: NOW,
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
