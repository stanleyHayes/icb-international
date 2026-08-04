import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef } from '../domain/account-ref.js';
import { HoldService } from '../hold.service.js';
import type { AccountBalanceDoc, HoldDoc } from '../infrastructure/ledger.schemas.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const SESSION = { id: 'fake-session' } as unknown as ClientSession;
const ACCOUNT = customerRef('01JACC0000000000000000A');
const HOLD_ID = '01JHOLD00000000000000A';

function holdRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: HOLD_ID,
    accountRef: ACCOUNT,
    minorUnits: 2_500,
    currency: 'USD',
    reason: 'Card authorisation',
    sourceType: 'card_authorisation',
    sourceId: '01JAUTH00000000000000A',
    placedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 60_000),
    releasedAt: null,
    releaseReason: null,
    ...overrides,
  };
}

function setup() {
  const capturedLockKeys: (readonly string[])[] = [];
  const holdsModel = {
    create: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({}),
    findById: vi.fn(),
    find: vi.fn(),
  };
  const balancesModel = { updateOne: vi.fn().mockResolvedValue({}), findOne: vi.fn() };
  const transactionManager = {
    withTransaction: vi.fn(
      async (
        work: (session: ClientSession) => Promise<unknown>,
        options: { lockKeys?: readonly string[] } = {},
      ) => {
        capturedLockKeys.push(options.lockKeys ?? []);
        return work(SESSION);
      },
    ),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new HoldService(
    holdsModel as unknown as Model<HoldDoc>,
    balancesModel as unknown as Model<AccountBalanceDoc>,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, holdsModel, balancesModel, transactionManager, capturedLockKeys };
}

/** A findById chain resolving to `row`, with or without a session hop. */
function findByIdChain(row: unknown) {
  return { session: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(row) };
}

describe('HoldService.release', () => {
  it('marks the hold released and hands the reservation back, inside a given session', async () => {
    const { service, holdsModel, balancesModel, transactionManager } = setup();
    holdsModel.findById.mockReturnValue(findByIdChain(holdRow()));

    await service.release(HOLD_ID, 'Captured', SESSION);

    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
    expect(holdsModel.updateOne).toHaveBeenCalledWith(
      { _id: HOLD_ID, releasedAt: null },
      { $set: { releasedAt: NOW, releaseReason: 'Captured' } },
      { session: SESSION },
    );
    expect(balancesModel.updateOne).toHaveBeenCalledWith(
      { accountRef: ACCOUNT, currency: 'USD' },
      expect.objectContaining({ $inc: { holdMinorUnits: -2_500 } }),
      { upsert: true, session: SESSION },
    );
  });

  it('opens its own transaction when no session is supplied, locking the hold’s balance', async () => {
    const { service, holdsModel, capturedLockKeys } = setup();
    holdsModel.findById
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(holdRow()) }) // lock-key pre-read
      .mockReturnValueOnce(findByIdChain(holdRow())); // authoritative read inside

    await service.release(HOLD_ID, 'Cancelled');

    expect(capturedLockKeys[0]).toEqual([`balance:${ACCOUNT}:USD`]);
    expect(holdsModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('throws a typed not-found error for an unknown hold', async () => {
    const { service, holdsModel } = setup();
    holdsModel.findById
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce(findByIdChain(null));

    await expect(service.release(HOLD_ID, 'Captured')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(holdsModel.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to release a hold that has already been released', async () => {
    const { service, holdsModel } = setup();
    holdsModel.findById.mockReturnValue(findByIdChain(holdRow({ releasedAt: NOW })));

    await expect(service.release(HOLD_ID, 'Captured', SESSION)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(holdsModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('HoldService.releaseBySource', () => {
  it('releases every open hold attached to the source and reports the count', async () => {
    const { service, holdsModel } = setup();
    holdsModel.find.mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi
        .fn()
        .mockResolvedValue([holdRow({ _id: '01JH1' }), holdRow({ _id: '01JH2' })]),
    });
    holdsModel.findById.mockImplementation((id: string) =>
      findByIdChain(holdRow({ _id: id })),
    );

    const released = await service.releaseBySource(
      'card_authorisation',
      '01JAUTH00000000000000A',
      'Transfer completed',
      SESSION,
    );

    expect(holdsModel.find).toHaveBeenCalledWith({
      sourceType: 'card_authorisation',
      sourceId: '01JAUTH00000000000000A',
      releasedAt: null,
    });
    expect(released).toBe(2);
    expect(holdsModel.updateOne).toHaveBeenCalledTimes(2);
  });

  it('reports zero when nothing is open for the source', async () => {
    const { service, holdsModel } = setup();
    holdsModel.find.mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });

    const released = await service.releaseBySource('transfer', '01JTRF', 'Cancelled', SESSION);

    expect(released).toBe(0);
    expect(holdsModel.findById).not.toHaveBeenCalled();
  });
});

describe('HoldService.expireDue', () => {
  it('releases every hold past its expiry as an authorisation expiry', async () => {
    const { service, holdsModel } = setup();
    holdsModel.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([holdRow({ _id: '01JH1' })]),
    });
    holdsModel.findById.mockImplementation((id: string) =>
      findByIdChain(holdRow({ _id: id })),
    );

    const expired = await service.expireDue();

    expect(holdsModel.find).toHaveBeenCalledWith({
      releasedAt: null,
      expiresAt: { $lte: NOW },
    });
    expect(expired).toBe(1);
    expect(holdsModel.updateOne).toHaveBeenCalledWith(
      { _id: '01JH1', releasedAt: null },
      { $set: { releasedAt: NOW, releaseReason: 'Authorisation expired' } },
      { session: SESSION },
    );
  });

  it('does nothing when no hold is due', async () => {
    const { service, holdsModel } = setup();
    holdsModel.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });

    const expired = await service.expireDue();

    expect(expired).toBe(0);
    expect(holdsModel.findById).not.toHaveBeenCalled();
  });
});
