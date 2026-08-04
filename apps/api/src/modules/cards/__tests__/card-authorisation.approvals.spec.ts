import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError, InsufficientFundsError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type AccountsService } from '../../accounts/accounts.service.js';
import { type HoldService } from '../../ledger/hold.service.js';
import {
  AUTHORISATION_EXPIRY_MS,
  AUTHORISATION_SOURCE,
  CardAuthorisationService,
  HOLD_REASON,
  type AuthoriseCardCommand,
} from '../application/card-authorisation.service.js';
import { type CardReader } from '../application/card-reader.js';
import { type SpendWindow } from '../application/card-spend.service.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { ACCOUNT_ID, CARD_ID, CUSTOMER_ID, NOW, cardDoc } from './fixtures.js';

const EMPTY_WINDOW: SpendWindow = { todayMinorUnits: 0, monthMinorUnits: 0, atmTodayMinorUnits: 0 };

interface SetupOptions {
  readonly card?: CardDoc;
  readonly availableMinorUnits?: number;
}

function setup(options: SetupOptions = {}) {
  const card = options.card ?? cardDoc();
  const model = {
    create: vi.fn().mockImplementation((docs: Record<string, unknown>[]) =>
      Promise.resolve(docs.map((doc) => ({ ...doc }))),
    ),
  };
  const reader = {
    loadById: vi.fn().mockResolvedValue(card),
    spendWindow: vi.fn().mockResolvedValue(EMPTY_WINDOW),
  };
  const available = options.availableMinorUnits ?? 1_000_000;
  const accounts = {
    balancesFor: vi.fn().mockResolvedValue({
      ledger: fromMinorUnits(available, 'USD'),
      holds: fromMinorUnits(0, 'USD'),
      available: fromMinorUnits(available, 'USD'),
    }),
  };
  const holds = { placeWithin: vi.fn().mockResolvedValue({ id: 'hold-9' }) };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work({ id: 's' })),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardAuthorisationService(
    model as unknown as Model<CardAuthorisationDoc>,
    reader as unknown as CardReader,
    accounts as unknown as AccountsService,
    holds as unknown as HoldService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, model, reader, accounts, holds, transactionManager };
}

function command(overrides: Partial<AuthoriseCardCommand> = {}): AuthoriseCardCommand {
  return {
    merchantName: 'Shoprite Accra',
    mcc: '5411',
    amount: { minorUnits: 25_000, currency: 'USD', scale: 2 },
    channel: 'in_store',
    country: 'GH',
    ...overrides,
  };
}

async function failureOf(promise: Promise<unknown>): Promise<DomainError> {
  const error = await promise.then(
    () => {
      throw new Error('Expected the authorisation to be declined');
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  return error as DomainError;
}

function writtenRecord(model: { create: ReturnType<typeof vi.fn> }): Record<string, unknown> {
  const docs = model.create.mock.calls[0]?.[0] as Record<string, unknown>[];
  return docs[0] ?? {};
}

describe('CardAuthorisationService approval', () => {
  it('reserves a seven-day hold and records the approval in one transaction', async () => {
    const deps = setup();

    const result = await deps.service.authorise(CARD_ID, command());

    expect(deps.accounts.balancesFor).toHaveBeenCalledWith(ACCOUNT_ID, 'USD');
    expect(deps.holds.placeWithin).toHaveBeenCalledWith(
      {
        accountRef: `acct:${ACCOUNT_ID}`,
        amount: { minorUnits: 25_000, currency: 'USD' },
        reason: HOLD_REASON,
        expiresInMs: AUTHORISATION_EXPIRY_MS,
        sourceType: AUTHORISATION_SOURCE,
        sourceId: expect.any(String) as unknown,
      },
      { id: 's' },
    );
    // The transaction queues on the account's balance key so concurrent authorisations serialise.
    expect(deps.transactionManager.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      lockKeys: [`balance:acct:${ACCOUNT_ID}:USD`],
    });
    expect(writtenRecord(deps.model)).toMatchObject({
      cardId: CARD_ID,
      customerId: CUSTOMER_ID,
      accountId: ACCOUNT_ID,
      merchantName: 'Shoprite Accra',
      mcc: '5411',
      category: 'groceries',
      channel: 'in_store',
      country: 'GH',
      minorUnits: 25_000,
      currency: 'USD',
      status: 'approved',
      declineReason: null,
      arn: expect.any(String),
      holdId: 'hold-9',
      transactionId: null,
      authorisedAt: NOW,
      expiresAt: new Date(NOW.getTime() + AUTHORISATION_EXPIRY_MS),
    });
    expect(result).toMatchObject({
      cardId: CARD_ID,
      merchantName: 'Shoprite Accra',
      amount: { minorUnits: 25_000, currency: 'USD' },
      status: 'approved',
      declineReason: null,
      authorisedAt: NOW.toISOString(),
    });
  });

  it('approves when the available balance exactly covers the purchase', async () => {
    const deps = setup({ availableMinorUnits: 25_000 });

    const result = await deps.service.authorise(CARD_ID, command());
    expect(result.status).toBe('approved');
    expect(deps.holds.placeWithin).toHaveBeenCalled();
  });

  it('reads the spend window for the card being authorised', async () => {
    const deps = setup();

    await deps.service.authorise(CARD_ID, command());
    expect(deps.reader.spendWindow).toHaveBeenCalledWith(CARD_ID);
  });

  it('throws a typed internal error when the authorisation cannot be recorded', async () => {
    const deps = setup();
    deps.model.create.mockResolvedValueOnce([undefined]);

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

describe('CardAuthorisationService funds check', () => {
  it('declines with INSUFFICIENT_FUNDS, logs the decline, and reserves nothing', async () => {
    const deps = setup({ availableMinorUnits: 10_000 });

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error).toBeInstanceOf(InsufficientFundsError);
    expect(error.code).toBe('INSUFFICIENT_FUNDS');
    expect(error.context).toMatchObject({
      accountId: ACCOUNT_ID,
      requestedMinorUnits: 25_000,
      availableMinorUnits: 10_000,
      currency: 'USD',
    });
    expect(writtenRecord(deps.model)).toMatchObject({
      status: 'declined',
      declineReason: 'Insufficient funds',
      arn: null,
      holdId: null,
    });
    expect(deps.holds.placeWithin).not.toHaveBeenCalled();
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });
});
