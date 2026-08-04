import type { CardDetail, IssueCardRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { CardIssuanceService } from '../application/card-issuance.service.js';
import type { CardReader } from '../application/card-reader.js';
import { defaultControls, defaultLimits } from '../domain/card-defaults.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { ACCOUNT_ID, CARD_ID, CUSTOMER_ID, NOW, cardDoc, chainQuery } from './fixtures.js';

const FIELD_KEY = 'a'.repeat(64);
const DETAIL = { id: CARD_ID } as unknown as CardDetail;
const INDIVIDUAL = { individual: { firstName: 'Ama', lastName: 'Mensah' }, business: null };

export function issueRequest(overrides: Partial<IssueCardRequest> = {}): IssueCardRequest {
  return {
    accountId: ACCOUNT_ID,
    kind: 'debit',
    network: 'visa',
    deliveryAddressId: 'residential',
    ...overrides,
  };
}

export function issuanceSetup(customer: Record<string, unknown> | null = INDIVIDUAL) {
  const cards = {
    create: vi.fn((docs: Record<string, unknown>[]) => Promise.resolve(docs)),
    exists: vi.fn().mockResolvedValue(null),
  };
  const customers = { findById: vi.fn().mockReturnValue(chainQuery(customer)) };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({
      _id: ACCOUNT_ID,
      customerId: CUSTOMER_ID,
      currency: 'USD',
    }),
  };
  const reader = { detail: vi.fn().mockResolvedValue(DETAIL) };
  const config = {
    bank: { name: 'Imperial Commerce Bank', country: 'GH' },
    crypto: { fieldEncryptionKey: FIELD_KEY },
  } as unknown as AppConfiguration;
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardIssuanceService(
    cards as unknown as Model<CardDoc>,
    customers as unknown as Model<CustomerDoc>,
    accounts as unknown as AccountsService,
    reader as unknown as CardReader,
    config,
    clock,
  );
  return { service, cards, customers, accounts, reader };
}

export type IssuanceDeps = ReturnType<typeof issuanceSetup>;

/** The one document `cards.create` was called with — the full identity of the new card. */
export function createdPayload(cards: IssuanceDeps['cards']): Record<string, unknown> {
  const doc = cards.create.mock.calls[0]?.[0]?.[0];
  if (!doc) {
    throw new Error('cards.create was not called with a document');
  }
  return doc;
}

describe('CardIssuanceService.issue', () => {
  let deps: IssuanceDeps;

  beforeEach(() => {
    deps = issuanceSetup();
  });

  it('issues an inactive card against the spendable account and returns its detail', async () => {
    const result = await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(deps.accounts.loadSpendable).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(createdPayload(deps.cards)).toEqual(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        accountId: ACCOUNT_ID,
        kind: 'debit',
        network: 'visa',
        status: 'issued',
        nickname: null,
        cardholderName: 'AMA MENSAH',
        expiryMonth: 8,
        expiryYear: 2029,
        currency: 'USD',
        issuingCountry: 'GH',
        frozen: false,
        contactlessEnabled: true,
        pinHash: null,
        pinSetAt: null,
        controls: defaultControls('debit'),
        limits: defaultLimits('debit'),
        issuedAt: NOW,
        activatedAt: null,
        deliveryAddressId: 'residential',
        replacedCardId: null,
      }),
    );
    expect(deps.reader.detail).toHaveBeenCalledWith(createdPayload(deps.cards));
    expect(result).toBe(DETAIL);
  });

  it('keeps a supplied nickname', async () => {
    await deps.service.issue(CUSTOMER_ID, issueRequest({ nickname: 'Everyday' }));

    expect(createdPayload(deps.cards)).toEqual(expect.objectContaining({ nickname: 'Everyday' }));
  });

  it('issues a virtual card with contactless off and the virtual channel defaults', async () => {
    await deps.service.issue(CUSTOMER_ID, issueRequest({ kind: 'virtual' }));

    expect(createdPayload(deps.cards)).toEqual(
      expect.objectContaining({
        kind: 'virtual',
        contactlessEnabled: false,
        controls: defaultControls('virtual'),
        limits: defaultLimits('virtual'),
      }),
    );
  });

  it('propagates a spendable-account rejection without creating anything', async () => {
    deps.accounts.loadSpendable.mockRejectedValue(new NotFoundError('Account', ACCOUNT_ID));

    await expect(deps.service.issue(CUSTOMER_ID, issueRequest())).rejects.toThrow(NotFoundError);
    expect(deps.cards.create).not.toHaveBeenCalled();
  });

  it('fails with a conflict when persistence returns no created card', async () => {
    deps.cards.create.mockResolvedValue([]);

    await expect(deps.service.issue(CUSTOMER_ID, issueRequest())).rejects.toThrow(ConflictError);
  });
});

describe('CardIssuanceService.issueAsStaff', () => {
  it('resolves the owning customer from the account, never from the staff client', async () => {
    const deps = issuanceSetup();

    const result = await deps.service.issueAsStaff(issueRequest());

    expect(deps.accounts.loadSpendable).toHaveBeenNthCalledWith(1, ACCOUNT_ID);
    expect(deps.accounts.loadSpendable).toHaveBeenNthCalledWith(2, ACCOUNT_ID, CUSTOMER_ID);
    expect(deps.customers.findById).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toBe(DETAIL);
  });
});

describe('CardIssuanceService.reissue', () => {
  it('keeps the identity of the retired card and links the replacement to it', async () => {
    const deps = issuanceSetup();
    const previous = cardDoc({ nickname: 'Everyday', deliveryAddressId: 'postal' });

    const replacement = await deps.service.reissue(previous);

    expect(deps.accounts.loadSpendable).not.toHaveBeenCalled();
    const payload = createdPayload(deps.cards);
    expect(payload).toEqual(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        accountId: ACCOUNT_ID,
        kind: 'debit',
        network: 'visa',
        nickname: 'Everyday',
        currency: 'USD',
        deliveryAddressId: 'postal',
        replacedCardId: CARD_ID,
        status: 'issued',
      }),
    );
    expect(replacement).toEqual(payload);
  });
});
