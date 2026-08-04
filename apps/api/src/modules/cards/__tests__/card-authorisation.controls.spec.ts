import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
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
import { defaultControls } from '../domain/card-defaults.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, NOW, cardDoc } from './fixtures.js';

const EMPTY_WINDOW: SpendWindow = { todayMinorUnits: 0, monthMinorUnits: 0, atmTodayMinorUnits: 0 };

interface SetupOptions {
  readonly card?: CardDoc;
  readonly window?: SpendWindow;
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
    spendWindow: vi.fn().mockResolvedValue(options.window ?? EMPTY_WINDOW),
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

async function expectControlDecline(
  card: CardDoc,
  overrides: Partial<AuthoriseCardCommand>,
  reason: string,
): Promise<void> {
  const deps = setup({ card });
  const error = await failureOf(deps.service.authorise(CARD_ID, command(overrides)));
  expect(error.code).toBe('CARD_CONTROL_DECLINED');
  expect(error.message).toBe(reason);
  expect(writtenRecord(deps.model)).toMatchObject({ status: 'declined', declineReason: reason });
  expect(deps.holds.placeWithin).not.toHaveBeenCalled();
}

describe('CardAuthorisationService card-state guards', () => {
  it('refuses a card in a terminal status before any money moves', async () => {
    const deps = setup({ card: cardDoc({ status: 'stolen' }) });

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error.code).toBe('CARD_BLOCKED');
    expect(deps.model.create).not.toHaveBeenCalled();
    expect(deps.reader.spendWindow).not.toHaveBeenCalled();
    expect(deps.holds.placeWithin).not.toHaveBeenCalled();
  });

  it('refuses a frozen card', async () => {
    const deps = setup({ card: cardDoc({ frozen: true, status: 'frozen' }) });

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error.code).toBe('CARD_BLOCKED');
    expect(error.message).toBe('This card is frozen');
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('refuses a card that has never been activated', async () => {
    const deps = setup({ card: cardDoc({ status: 'issued', activatedAt: null }) });

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error.code).toBe('CARD_BLOCKED');
    expect(error.message).toBe('This card has not been activated yet');
  });

  it('refuses a card past its printed expiry month', async () => {
    const deps = setup({ card: cardDoc({ expiryMonth: 7, expiryYear: 2026 }) });

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error.code).toBe('CARD_EXPIRED');
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('rejects a billing currency the card does not hold, without reading spend', async () => {
    const deps = setup();

    const error = await failureOf(
      deps.service.authorise(
        CARD_ID,
        command({ amount: { minorUnits: 25_000, currency: 'GHS', scale: 2 } }),
      ),
    );
    expect(error.code).toBe('ACCOUNT_CURRENCY_MISMATCH');
    expect(deps.reader.spendWindow).not.toHaveBeenCalled();
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('propagates the typed not-found for an unknown card', async () => {
    const deps = setup();
    deps.reader.loadById.mockRejectedValue(new DomainError('CARD_NOT_FOUND', 'That card was not found'));

    const error = await failureOf(deps.service.authorise(CARD_ID, command()));
    expect(error.code).toBe('CARD_NOT_FOUND');
    expect(deps.model.create).not.toHaveBeenCalled();
  });
});

describe('CardAuthorisationService control declines', () => {
  it('declines a channel the customer switched off', async () => {
    const controls = { ...defaultControls('debit'), channels: { ...defaultControls('debit').channels, online: false } };
    await expectControlDecline(
      cardDoc({ controls }),
      { channel: 'online' },
      'online payments are switched off for this card',
    );
  });

  it('declines a tap when the card-level contactless switch is off, even if the control allows it', async () => {
    await expectControlDecline(
      cardDoc({ contactlessEnabled: false }),
      { channel: 'contactless' },
      'contactless payments are switched off for this card',
    );
  });

  it('declines a merchant in a blocked spending category', async () => {
    const controls = { ...defaultControls('debit'), blockedCategories: ['groceries' as const] };
    await expectControlDecline(
      cardDoc({ controls }),
      {},
      'groceries spending is blocked on this card',
    );
  });

  it('declines an international payment when the international switch is off', async () => {
    await expectControlDecline(
      cardDoc(),
      { country: 'US' },
      'International payments are switched off for this card',
    );
  });

  it('declines a country outside the allow list', async () => {
    const controls = {
      ...defaultControls('debit'),
      channels: { ...defaultControls('debit').channels, international: true },
      allowedCountries: ['GH'],
    };
    await expectControlDecline(
      cardDoc({ controls }),
      { country: 'FR' },
      'This card is not enabled for payments in FR',
    );
  });

  it('approves a payment in a country covered by an active travel notice', async () => {
    const deps = setup({
      card: cardDoc({
        travelNoticeFrom: null,
        travelNoticeUntil: new Date(NOW.getTime() + 86_400_000),
        travelCountries: ['US'],
      }),
    });

    const result = await deps.service.authorise(CARD_ID, command({ country: 'US' }));
    expect(result.status).toBe('approved');
  });

  it('ignores a travel notice whose window has already closed', async () => {
    await expectControlDecline(
      cardDoc({
        travelNoticeFrom: new Date(NOW.getTime() - 2 * 86_400_000),
        travelNoticeUntil: new Date(NOW.getTime() - 86_400_000),
        travelCountries: ['US'],
      }),
      { country: 'US' },
      'International payments are switched off for this card',
    );
  });
});
