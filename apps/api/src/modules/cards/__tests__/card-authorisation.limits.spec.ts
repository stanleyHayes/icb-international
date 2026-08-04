import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError, LimitExceededError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type AccountsService } from '../../accounts/accounts.service.js';
import { type HoldService } from '../../ledger/hold.service.js';
import {
  CardAuthorisationService,
  type AuthoriseCardCommand,
} from '../application/card-authorisation.service.js';
import { type CardReader } from '../application/card-reader.js';
import { type SpendWindow } from '../application/card-spend.service.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, NOW, cardDoc } from './fixtures.js';

const EMPTY_WINDOW: SpendWindow = { todayMinorUnits: 0, monthMinorUnits: 0, atmTodayMinorUnits: 0 };

interface SetupOptions {
  readonly card?: CardDoc;
  readonly window?: SpendWindow;
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
    spendWindow: vi.fn().mockResolvedValue(options.window ?? EMPTY_WINDOW),
  };
  const accounts = {
    balancesFor: vi.fn().mockResolvedValue({
      ledger: fromMinorUnits(1_000_000, 'USD'),
      holds: fromMinorUnits(0, 'USD'),
      available: fromMinorUnits(1_000_000, 'USD'),
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
  return { service, model, holds, transactionManager };
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

async function expectLimitDecline(
  options: SetupOptions,
  overrides: Partial<AuthoriseCardCommand>,
  reason: string,
): Promise<void> {
  const deps = setup(options);
  const error = await failureOf(deps.service.authorise(CARD_ID, command(overrides)));
  expect(error).toBeInstanceOf(LimitExceededError);
  expect(error.code).toBe('LIMIT_EXCEEDED');
  expect(error.message).toBe(reason);
  // A declined authorisation is still an authorisation: it is logged, with no money reserved.
  expect(writtenRecord(deps.model)).toMatchObject({
    status: 'declined',
    declineReason: reason,
    arn: null,
    holdId: null,
  });
  expect(deps.holds.placeWithin).not.toHaveBeenCalled();
  expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
}

describe('CardAuthorisationService limit declines', () => {
  it('declines a purchase above the per-transaction limit', async () => {
    await expectLimitDecline(
      {},
      { amount: { minorUnits: 200_001, currency: 'USD', scale: 2 } },
      'This transaction exceeds your per-transaction limit',
    );
  });

  it('declines a tap above the contactless limit', async () => {
    await expectLimitDecline(
      {},
      { channel: 'contactless', amount: { minorUnits: 10_001, currency: 'USD', scale: 2 } },
      'This transaction exceeds your contactless limit',
    );
  });

  it('counts earlier withdrawals today against the daily ATM limit', async () => {
    await expectLimitDecline(
      { window: { ...EMPTY_WINDOW, atmTodayMinorUnits: 90_000 } },
      { channel: 'atm', mcc: '6011' },
      'This transaction exceeds your daily ATM limit',
    );
  });

  it('counts earlier spending today against the daily card limit', async () => {
    await expectLimitDecline(
      { window: { ...EMPTY_WINDOW, todayMinorUnits: 480_000 } },
      {},
      'This transaction exceeds your daily card limit',
    );
  });

  it('counts earlier spending this month against the monthly card limit', async () => {
    await expectLimitDecline(
      { window: { ...EMPTY_WINDOW, monthMinorUnits: 4_990_000 } },
      {},
      'This transaction exceeds your monthly card limit',
    );
  });

  it('approves a purchase sitting exactly on the per-transaction limit', async () => {
    const deps = setup();

    const result = await deps.service.authorise(
      CARD_ID,
      command({ amount: { minorUnits: 200_000, currency: 'USD', scale: 2 } }),
    );
    expect(result.status).toBe('approved');
  });

  it('does not apply the contactless limit to a chip purchase of the same size', async () => {
    const deps = setup();

    const result = await deps.service.authorise(
      CARD_ID,
      command({ amount: { minorUnits: 15_000, currency: 'USD', scale: 2 } }),
    );
    expect(result.status).toBe('approved');
  });
});
