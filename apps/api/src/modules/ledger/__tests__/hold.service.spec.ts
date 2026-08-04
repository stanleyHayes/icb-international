import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { HoldService, type PlaceHoldCommand } from '../hold.service.js';
import type { AccountBalanceDoc, HoldDoc } from '../infrastructure/ledger.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const SESSION = { id: 'session-1' } as unknown as ClientSession;
const ACCOUNT_REF = 'acct:01J8ZCAAAAAAAAAAAAAAAAAA';

/** A thenable query chain mirroring how the service consumes Mongoose. */
function queryChain<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function holdDoc(overrides: Partial<HoldDoc> = {}): HoldDoc {
  return {
    _id: '01JHOLD0000000000000000A',
    accountRef: ACCOUNT_REF,
    minorUnits: 5_000,
    currency: 'USD',
    reason: 'Card authorisation',
    sourceType: 'card-auth',
    sourceId: 'auth-1',
    placedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 60_000),
    releasedAt: null,
    releaseReason: null,
    ...overrides,
  };
}

function command(overrides: Partial<PlaceHoldCommand> = {}): PlaceHoldCommand {
  return {
    accountRef: ACCOUNT_REF,
    amount: fromMinorUnits(5_000, 'USD'),
    reason: 'Card authorisation',
    expiresInMs: 60_000,
    ...overrides,
  };
}

function setup({ open = [] as HoldDoc[], hold = null as HoldDoc | null } = {}) {
  const findChain = queryChain(open);
  const findByIdChain = queryChain(hold);
  const holds = {
    create: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue(findChain),
    findById: vi.fn().mockReturnValue(findByIdChain),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const balances = {
    findOne: vi.fn().mockReturnValue(queryChain(null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const transactionManager = {
    withTransaction: vi.fn((fn: (session: ClientSession) => unknown) => fn(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new HoldService(
    holds as unknown as Model<HoldDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, holds, balances, transactionManager, findChain, findByIdChain };
}

describe('HoldService.place', () => {
  it('queues on the account balance key and writes the hold inside a transaction', async () => {
    const { service, holds, balances, transactionManager } = setup();

    const hold = await service.place(command());

    expect(transactionManager.withTransaction).toHaveBeenCalledOnce();
    expect(holds.create).toHaveBeenCalledOnce();
    const [docs] = holds.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(docs[0]).toMatchObject({
      accountRef: ACCOUNT_REF,
      minorUnits: 5_000,
      currency: 'USD',
      sourceType: null,
      sourceId: null,
      placedAt: NOW,
      releasedAt: null,
    });
    expect(balances.updateOne).toHaveBeenCalledWith(
      { accountRef: ACCOUNT_REF, currency: 'USD' },
      expect.objectContaining({ $inc: { holdMinorUnits: 5_000 } }),
      { upsert: true, session: SESSION },
    );
    expect(hold.placedAt).toEqual(NOW);
    expect(hold.expiresAt).toEqual(new Date(NOW.getTime() + 60_000));
    expect(hold.releasedAt).toBeNull();
  });
});

describe('HoldService.placeWithin', () => {
  it('rejects a non-positive amount before touching the database', async () => {
    const { service, holds } = setup();

    await expect(
      service.placeWithin(command({ amount: fromMinorUnits(0, 'USD') }), SESSION),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(holds.create).not.toHaveBeenCalled();
  });

  it('stamps placedAt and expiresAt from the frozen clock', async () => {
    const { service } = setup();

    const hold = await service.placeWithin(command({ expiresInMs: 5_000 }), SESSION);

    expect(hold.expiresAt.getTime() - hold.placedAt.getTime()).toBe(5_000);
  });
});

describe('HoldService.release', () => {
  it('throws NotFoundError when the hold does not exist', async () => {
    const { service } = setup({ hold: null });

    await expect(service.release('missing', 'cancelled', SESSION)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws ConflictError when the hold was already released', async () => {
    const { service } = setup({ hold: holdDoc({ releasedAt: NOW }) });

    await expect(service.release('id', 'cancelled', SESSION)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('marks the hold released and decrements the held total', async () => {
    const { service, holds, balances } = setup({ hold: holdDoc() });

    await service.release('id', 'captured', SESSION);

    expect(holds.updateOne).toHaveBeenCalledWith(
      { _id: 'id', releasedAt: null },
      { $set: { releasedAt: NOW, releaseReason: 'captured' } },
      { session: SESSION },
    );
    expect(balances.updateOne).toHaveBeenCalledWith(
      { accountRef: ACCOUNT_REF, currency: 'USD' },
      expect.objectContaining({ $inc: { holdMinorUnits: -5_000 } }),
      { upsert: true, session: SESSION },
    );
  });

  it('opens its own transaction when no session is supplied', async () => {
    const { service, transactionManager } = setup({ hold: holdDoc() });

    await service.release('id', 'cancelled');

    expect(transactionManager.withTransaction).toHaveBeenCalledOnce();
  });
});

describe('HoldService.releaseBySource', () => {
  it('releases every open hold for the source and returns the count', async () => {
    const open = [holdDoc({ _id: 'h1' }), holdDoc({ _id: 'h2' })];
    const { service, holds } = setup({ open });
    holds.findById.mockImplementation((id: string) =>
      queryChain(open.find((h) => h._id === id) ?? null),
    );

    const released = await service.releaseBySource('card-auth', 'auth-1', 'completed', SESSION);

    expect(released).toBe(2);
    expect(holds.updateOne).toHaveBeenCalledTimes(2);
  });

  it('returns zero when nothing is open for the source', async () => {
    const { service, holds } = setup({ open: [] });

    const released = await service.releaseBySource('card-auth', 'auth-1', 'completed', SESSION);

    expect(released).toBe(0);
    expect(holds.updateOne).not.toHaveBeenCalled();
  });
});

describe('HoldService.expireDue', () => {
  it('releases every hold past its expiry and returns the sweep count', async () => {
    const due = [holdDoc({ _id: 'h1' })];
    const { service, holds, transactionManager } = setup({ open: due });
    holds.findById.mockReturnValue(queryChain(due[0]));

    const expired = await service.expireDue();

    expect(expired).toBe(1);
    expect(holds.find).toHaveBeenCalledWith({ releasedAt: null, expiresAt: { $lte: NOW } });
    expect(transactionManager.withTransaction).toHaveBeenCalled();
  });
});

describe('HoldService.totalFor', () => {
  it('returns the cached held total as money', async () => {
    const { service, balances } = setup();
    balances.findOne.mockReturnValue(queryChain({ holdMinorUnits: 7_500 }));

    const total = await service.totalFor(ACCOUNT_REF, 'USD');

    expect(total.minorUnits).toBe(7_500);
    expect(total.currency).toBe('USD');
  });

  it('returns zero when the account has no balance document', async () => {
    const { service } = setup();

    const total = await service.totalFor(ACCOUNT_REF, 'USD');

    expect(total.minorUnits).toBe(0);
  });
});

describe('HoldService.listOpen', () => {
  it('maps open holds newest-first into records', async () => {
    const open = [holdDoc({ _id: 'h1' })];
    const { service } = setup({ open });

    const records = await service.listOpen(ACCOUNT_REF);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'h1',
      accountRef: ACCOUNT_REF,
      reason: 'Card authorisation',
      amount: { minorUnits: 5_000, currency: 'USD' },
    });
  });
});
