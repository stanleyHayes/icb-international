import { vi } from 'vitest';

import type { BeneficiaryDoc } from '../infrastructure/beneficiary.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const BENEFICIARY_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9B1';
export const CUSTOMER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9B2';
export const ACCOUNT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9B3';

/** A destination that parses cleanly through `transferDestinationSchema` in the mapper. */
export const DESTINATION = {
  kind: 'domestic_bank',
  accountNumber: '12345678',
  sortCode: '04-06-75',
  accountHolderName: 'Ama Mensah',
} as const;

/** An unverified payee inside its cooling-off window; tests override the fields they exercise. */
export function beneficiaryDoc(overrides: Partial<BeneficiaryDoc> = {}): BeneficiaryDoc {
  return {
    _id: BENEFICIARY_ID,
    customerId: CUSTOMER_ID,
    nickname: 'Mum',
    name: 'Ama Mensah',
    destination: { ...DESTINATION },
    destinationKey: 'domestic_bank:04067512345678',
    displayIdentifier: '•••• 5678',
    bankName: null,
    currency: null,
    icbAccountId: null,
    verified: false,
    favourite: false,
    coolingOffUntil: new Date(NOW.getTime() + 2 * 3_600_000),
    lastUsedAt: null,
    useCount: 0,
    addedAt: NOW,
    verificationState: 'not_started',
    verificationAttemptsRemaining: 3,
    verificationHash: null,
    depositsSentAt: null,
    verifiedAt: null,
    microDepositTransactionIds: [],
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
