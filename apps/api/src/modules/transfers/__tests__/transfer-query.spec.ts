import type { TransferQuery } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { encodeCursor } from '../../../common/pagination/cursor.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  buildTransferFilter,
  spentOnRailToday,
} from '../infrastructure/transfer-query.js';
import type { TransferDoc } from '../infrastructure/transfer.schemas.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

function query(overrides: Partial<TransferQuery> = {}): TransferQuery {
  return overrides as TransferQuery;
}

describe('spentOnRailToday', () => {
  it('sums debits since the start of the frozen business day, excluding failures', async () => {
    const transfers = { aggregate: vi.fn().mockResolvedValue([{ total: 42_000 }]) };

    const spent = await spentOnRailToday(
      transfers as unknown as Model<TransferDoc>,
      'cust-1',
      'internal',
      frozenClock(),
    );

    expect(spent).toBe(42_000);
    const [pipeline] = transfers.aggregate.mock.calls[0] as [
      { $match: Record<string, unknown> }[],
    ];
    expect(pipeline[0]?.$match).toMatchObject({
      customerId: 'cust-1',
      rail: 'internal',
      createdAt: { $gte: new Date('2026-08-04T00:00:00.000Z') },
      status: { $nin: ['failed', 'cancelled'] },
    });
  });

  it('reports zero when nothing has spent today', async () => {
    const transfers = { aggregate: vi.fn().mockResolvedValue([]) };

    const spent = await spentOnRailToday(
      transfers as unknown as Model<TransferDoc>,
      'cust-1',
      'ach',
      frozenClock(),
    );

    expect(spent).toBe(0);
  });
});

describe('buildTransferFilter', () => {
  it('scopes to the customer even with no parameters', () => {
    expect(buildTransferFilter('cust-1', query())).toEqual({ customerId: 'cust-1' });
  });

  it('decodes the cursor into a strictly-newer clause', () => {
    const filter = buildTransferFilter('cust-1', query({ cursor: encodeCursor('01JLAST') }));

    expect(filter['_id']).toEqual({ $gt: '01JLAST' });
  });

  it('adds one clause per supplied parameter', () => {
    const filter = buildTransferFilter(
      'cust-1',
      query({
        accountId: 'acct-1',
        status: ['completed'],
        rail: ['internal', 'ach'],
        recurringOnly: true,
        from: '2026-08-01',
        to: '2026-08-04',
      }),
    );

    expect(filter).toEqual({
      customerId: 'cust-1',
      fromAccountId: 'acct-1',
      status: { $in: ['completed'] },
      rail: { $in: ['internal', 'ach'] },
      recurring: true,
      createdAt: {
        $gte: new Date('2026-08-01T00:00:00.000Z'),
        $lte: new Date('2026-08-04T23:59:59.999Z'),
      },
    });
  });

  it('ignores empty status and rail lists', () => {
    const filter = buildTransferFilter('cust-1', query({ status: [], rail: [] }));

    expect(filter).toEqual({ customerId: 'cust-1' });
  });

  it('supports open-ended date ranges', () => {
    expect(buildTransferFilter('cust-1', query({ from: '2026-08-01' }))['createdAt']).toEqual({
      $gte: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(buildTransferFilter('cust-1', query({ to: '2026-08-04' }))['createdAt']).toEqual({
      $lte: new Date('2026-08-04T23:59:59.999Z'),
    });
  });
});
