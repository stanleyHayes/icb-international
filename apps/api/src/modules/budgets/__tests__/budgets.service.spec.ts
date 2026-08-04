import type { SpendByCategory } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClockService } from '../../../simulation/clock/clock.service.js';
import type { TransactionAnalyticsService } from '../../transactions/analytics.service.js';
import { BudgetsService } from '../budgets.service.js';
import type { BudgetDoc } from '../infrastructure/budget.schemas.js';

const USD = { scale: 2, currency: 'USD' } as const;

function doc(overrides: Partial<BudgetDoc> = {}): BudgetDoc {
  return {
    _id: '01JBUDGET0000000000000001',
    customerId: 'cust-1',
    category: 'groceries',
    currency: 'USD',
    limitMinorUnits: 50_000,
    ...overrides,
  };
}

function spend(categories: ReadonlyArray<{ category: string; minorUnits: number }>): SpendByCategory {
  return {
    period: { from: '2026-08-01', to: '2026-08-31' },
    currency: 'USD',
    total: { minorUnits: 0, ...USD },
    categories: categories.map((row) => ({
      category: row.category as SpendByCategory['categories'][number]['category'],
      amount: { minorUnits: row.minorUnits, ...USD },
      share: 0,
      transactionCount: 1,
      changeFromPreviousPeriod: null,
    })),
  };
}

function modelDouble() {
  return {
    find: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
}

/** August 2026, pinned by the simulated clock. */
function clockDouble(): ClockService {
  return {
    now: () => new Date('2026-08-15T12:00:00.000Z'),
    monthBounds: () => ({
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-31T23:59:59.999Z'),
    }),
    toIsoDate: (date: Date) => date.toISOString().slice(0, 10),
  } as unknown as ClockService;
}

describe('BudgetsService', () => {
  let model: ReturnType<typeof modelDouble>;
  let analytics: { spendByCategory: ReturnType<typeof vi.fn> };
  let service: BudgetsService;

  beforeEach(() => {
    model = modelDouble();
    analytics = { spendByCategory: vi.fn().mockResolvedValue(spend([])) };
    service = new BudgetsService(
      model as unknown as Model<BudgetDoc>,
      analytics as unknown as TransactionAnalyticsService,
      clockDouble(),
    );
  });

  it('answers an empty overview for a customer with no budgets', async () => {
    model.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    const overview = await service.overview('cust-1');

    expect(overview).toEqual({ month: '2026-08', budgets: [] });
    expect(analytics.spendByCategory).not.toHaveBeenCalled();
  });

  it('evaluates each budget against the current simulated month', async () => {
    model.find.mockReturnValue({ lean: () => Promise.resolve([doc()]) });
    analytics.spendByCategory.mockResolvedValue(spend([{ category: 'groceries', minorUnits: 45_000 }]));

    const overview = await service.overview('cust-1');

    expect(analytics.spendByCategory).toHaveBeenCalledWith('cust-1', {
      currency: 'USD',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(overview.budgets[0]).toMatchObject({
      category: 'groceries',
      status: 'approaching',
      limit: { minorUnits: 50_000 },
      spent: { minorUnits: 45_000 },
    });
  });

  it('marks a budget exceeded only once spend passes the limit', async () => {
    model.find.mockReturnValue({ lean: () => Promise.resolve([doc()]) });
    analytics.spendByCategory.mockResolvedValue(
      spend([{ category: 'groceries', minorUnits: 50_001 }]),
    );

    const overview = await service.overview('cust-1');

    expect(overview.budgets[0]?.status).toBe('exceeded');
  });

  it('treats a category with no spend as on track', async () => {
    model.find.mockReturnValue({ lean: () => Promise.resolve([doc()]) });

    const overview = await service.overview('cust-1');

    expect(overview.budgets[0]).toMatchObject({ status: 'on_track', spent: { minorUnits: 0 } });
  });

  it('replaces the set: drops categories no longer present, upserts the rest', async () => {
    model.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    await service.replace('cust-1', [
      { category: 'dining', limit: { minorUnits: 20_000, ...USD } },
      { category: 'transport', limit: { minorUnits: 10_000, ...USD } },
    ]);

    expect(model.deleteMany).toHaveBeenCalledWith({
      customerId: 'cust-1',
      category: { $nin: ['dining', 'transport'] },
    });
    expect(model.updateOne).toHaveBeenCalledTimes(2);
    const [filter, update, options] = model.updateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> },
      unknown,
    ];
    expect(filter).toEqual({ customerId: 'cust-1', category: 'dining' });
    expect(update.$set).toEqual({ currency: 'USD', limitMinorUnits: 20_000 });
    expect(update.$setOnInsert).toEqual({ customerId: 'cust-1', category: 'dining' });
    expect(options).toEqual({ upsert: true });
  });
});
