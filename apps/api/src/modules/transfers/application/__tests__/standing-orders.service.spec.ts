import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../../common/errors/index.js';
import { ClockService } from '../../../../simulation/clock/clock.service.js';
import { InvalidScheduleError } from '../../domain/transfer-errors.js';
import type { StandingOrderDoc } from '../../infrastructure/standing-order.schemas.js';
import type { TransferDoc } from '../../infrastructure/transfer.schemas.js';
import {
  StandingOrdersService,
  type StandingOrderTerms,
} from '../standing-orders.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const SESSION = { id: 'session-1' } as unknown as ClientSession;

function queryChain<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function terms(overrides: Partial<StandingOrderTerms> = {}): StandingOrderTerms {
  return {
    customerId: 'cust-1',
    fromAccountId: 'acct-1',
    destination: { kind: 'internal', accountId: 'acct-2' },
    amountMinorUnits: 25_000,
    currency: 'USD',
    reference: null,
    note: null,
    name: 'Rent',
    ...overrides,
  };
}

function orderDoc(overrides: Partial<StandingOrderDoc> = {}): StandingOrderDoc {
  return {
    _id: 'so-1',
    customerId: 'cust-1',
    name: 'Rent',
    fromAccountId: 'acct-1',
    destination: { kind: 'internal', accountId: 'acct-2' },
    amountMinorUnits: 25_000,
    currency: 'USD',
    reference: null,
    note: null,
    schedule: { rrule: 'FREQ=MONTHLY', startsOn: '2026-08-10', endsOn: null, maxOccurrences: null },
    nextRunAt: new Date('2026-08-10T09:00:00.000Z'),
    status: 'active',
    executedCount: 0,
    createdAt: NOW,
    ...overrides,
  };
}

function setup({ orders = [] as StandingOrderDoc[], updated = null as StandingOrderDoc | null } = {}) {
  const ordersModel = {
    create: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue(queryChain(orders)),
    findById: vi.fn().mockReturnValue(queryChain(null)),
    findOneAndUpdate: vi.fn().mockReturnValue(queryChain(updated)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const transfersModel = {
    create: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ matchedCount: 0 }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new StandingOrdersService(
    ordersModel as unknown as Model<StandingOrderDoc>,
    transfersModel as unknown as Model<TransferDoc>,
    clock,
  );
  return { service, ordersModel, transfersModel };
}

describe('StandingOrdersService.plan', () => {
  it('returns a one-off schedule without creating a standing order', async () => {
    const { service, ordersModel } = setup();

    const plan = await service.plan(terms(), { startsOn: '2026-08-10' });

    expect(plan.standingOrderId).toBeNull();
    expect(plan.nextOccurrenceAt).toBeNull();
    expect(plan.executeAt.toISOString()).toBe('2026-08-10T09:00:00.000Z');
    // A one-off still carries its schedule; only the recurrence rule is absent.
    expect(plan.schedule).not.toBeNull();
    expect(plan.schedule?.rrule).toBeNull();
    expect(ordersModel.create).not.toHaveBeenCalled();
  });

  it('creates the series and returns its first two occurrences', async () => {
    const { service, ordersModel } = setup();

    const plan = await service.plan(terms(), { startsOn: '2026-08-10', rrule: 'FREQ=MONTHLY' });

    expect(plan.standingOrderId).not.toBeNull();
    expect(plan.executeAt.toISOString()).toBe('2026-08-10T09:00:00.000Z');
    expect(plan.nextOccurrenceAt?.toISOString()).toBe('2026-09-10T09:00:00.000Z');

    const [docs] = ordersModel.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(docs[0]).toMatchObject({
      _id: plan.standingOrderId,
      customerId: 'cust-1',
      name: 'Rent',
      status: 'active',
      executedCount: 0,
      nextRunAt: new Date('2026-09-10T09:00:00.000Z'),
    });
  });

  it('passes the session through when given one', async () => {
    const { service, ordersModel } = setup();

    await service.plan(terms(), { startsOn: '2026-08-10', rrule: 'FREQ=MONTHLY' }, SESSION);

    expect(ordersModel.create).toHaveBeenCalledWith(expect.anything(), {
      session: SESSION,
      ordered: true,
    });
  });

  it('rejects a series with no future occurrences', async () => {
    const { service } = setup();

    await expect(
      service.plan(terms(), { startsOn: '2026-08-01', rrule: 'FREQ=DAILY;COUNT=1' }),
    ).rejects.toBeInstanceOf(InvalidScheduleError);
  });
});

describe('StandingOrdersService.list', () => {
  it('maps stored orders newest-first into the contract shape', async () => {
    const { service } = setup({ orders: [orderDoc()] });

    const [order] = await service.list('cust-1');

    expect(order).toMatchObject({
      id: 'so-1',
      name: 'Rent',
      status: 'active',
      executedCount: 0,
      nextRunAt: '2026-08-10T09:00:00.000Z',
      createdAt: NOW.toISOString(),
      amount: { minorUnits: 25_000, currency: 'USD' },
    });
    expect(order?.schedule.rrule).toBe('FREQ=MONTHLY');
  });
});

describe('StandingOrdersService.cancel', () => {
  it('throws NotFoundError when no active order matches', async () => {
    const { service } = setup({ updated: null });

    await expect(service.cancel('cust-1', 'so-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cancels the series and its materialised future transfers', async () => {
    const { service, transfersModel } = setup({
      updated: orderDoc({ status: 'cancelled', nextRunAt: null }),
    });

    const cancelled = await service.cancel('cust-1', 'so-1');

    expect(cancelled.status).toBe('cancelled');
    expect(transfersModel.updateMany).toHaveBeenCalledWith(
      { standingOrderId: 'so-1', customerId: 'cust-1', status: 'scheduled' },
      expect.objectContaining({ $set: { status: 'cancelled' } }),
    );
  });
});

describe('StandingOrdersService.advance', () => {
  const executed = {
    _id: 'trf-1',
    customerId: 'cust-1',
    fromAccountId: 'acct-1',
    destination: { kind: 'internal', accountId: 'acct-2' },
    rail: 'internal',
    debitMinorUnits: 25_000,
    creditMinorUnits: 25_000,
    currency: 'USD',
    creditCurrency: null,
    feeMinorUnits: 0,
    feeBreakdown: [],
    fx: null,
    recipientName: null,
    recipientMasked: null,
    customerReference: null,
    note: null,
    standingOrderId: 'so-1',
    schedule: { rrule: 'FREQ=MONTHLY', startsOn: '2026-08-10', endsOn: null, maxOccurrences: null },
  } as unknown as TransferDoc;

  it('returns null for a transfer that is not part of a series', async () => {
    const { service } = setup();

    const result = await service.advance({ ...executed, standingOrderId: null }, SESSION);

    expect(result).toBeNull();
  });

  it('returns null when the order is no longer active', async () => {
    const { service, ordersModel } = setup();
    ordersModel.findById.mockReturnValue(queryChain(orderDoc({ status: 'cancelled' })));

    const result = await service.advance(executed, SESSION);

    expect(result).toBeNull();
  });

  it('counts the run and materialises the next occurrence', async () => {
    const { service, ordersModel, transfersModel } = setup();
    ordersModel.findById.mockReturnValue(queryChain(orderDoc()));

    const result = await service.advance(executed, SESSION);

    expect(ordersModel.updateOne).toHaveBeenCalledWith(
      { _id: 'so-1' },
      expect.objectContaining({ $inc: { executedCount: 1 } }),
      { session: SESSION },
    );
    expect(transfersModel.create).toHaveBeenCalledOnce();
    const [docs] = transfersModel.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(docs[0]).toMatchObject({ standingOrderId: 'so-1', status: 'scheduled' });
    expect(result?.executeAt.toISOString()).toBe('2026-08-10T09:00:00.000Z');
  });

  it('completes the series when the rule has run out', async () => {
    const { service, ordersModel, transfersModel } = setup();
    ordersModel.findById.mockReturnValue(
      queryChain(
        orderDoc({
          schedule: {
            rrule: 'FREQ=DAILY;COUNT=1',
            startsOn: '2026-08-01',
            endsOn: null,
            maxOccurrences: null,
          },
        }),
      ),
    );

    const result = await service.advance(executed, SESSION);

    expect(result).toBeNull();
    expect(ordersModel.updateOne).toHaveBeenCalledWith(
      { _id: 'so-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) }),
      { session: SESSION },
    );
    expect(transfersModel.create).not.toHaveBeenCalled();
  });
});
