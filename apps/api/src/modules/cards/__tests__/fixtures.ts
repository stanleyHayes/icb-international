import { vi } from 'vitest';

import { defaultControls, defaultLimits } from '../domain/card-defaults.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';

export const NOW = new Date('2026-08-02T12:00:00.000Z');
export const CARD_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T1';
export const CUSTOMER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T2';
export const ACCOUNT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T3';
export const AUTHORISATION_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T4';

/** A fully-populated active debit card; tests override the fields they exercise. */
export function cardDoc(overrides: Record<string, unknown> = {}): CardDoc {
  return {
    _id: CARD_ID,
    customerId: CUSTOMER_ID,
    accountId: ACCOUNT_ID,
    kind: 'debit',
    network: 'visa',
    status: 'active',
    nickname: null,
    cardholderName: 'AMA MENSAH',
    panEncrypted: 'enc:pan',
    panFingerprint: 'fp:pan',
    panLast4: '4242',
    cvvEncrypted: 'enc:cvv',
    expiryMonth: 8,
    expiryYear: 2029,
    currency: 'USD',
    issuingCountry: 'GH',
    frozen: false,
    contactlessEnabled: true,
    pinHash: 'argon2:hash',
    pinSetAt: NOW,
    controls: defaultControls('debit'),
    limits: defaultLimits('debit'),
    deliveryAddressId: 'residential',
    issuedAt: NOW,
    activatedAt: NOW,
    cancelledAt: null,
    cancellationReason: null,
    replacedCardId: null,
    replacedByCardId: null,
    travelNoticeFrom: null,
    travelNoticeUntil: null,
    travelCountries: [],
    reportedReason: null,
    reportedAt: null,
    blockedReason: null,
    blockedBy: null,
    blockedAt: null,
    ...overrides,
  };
}

/** An approved authorisation with an open hold; tests override the fields they exercise. */
export function authorisationDoc(overrides: Record<string, unknown> = {}): CardAuthorisationDoc {
  return {
    _id: AUTHORISATION_ID,
    cardId: CARD_ID,
    customerId: CUSTOMER_ID,
    accountId: ACCOUNT_ID,
    merchantName: 'Shoprite Accra',
    mcc: '5411',
    category: 'groceries',
    channel: 'in_store',
    country: 'GH',
    minorUnits: 25_000,
    billingMinorUnits: 25_000,
    capturedMinorUnits: null,
    currency: 'USD',
    status: 'approved',
    declineReason: null,
    arn: 'ARN123',
    holdId: 'hold-1',
    transactionId: null,
    authorisedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 7 * 86_400_000),
    capturedAt: null,
    reversedAt: null,
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
