import { rateTableSchema, type RateTable } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { ProductDoc } from '../infrastructure/product.schemas.js';
import {
  CACHE_NAMESPACE,
  RATE_TABLE_CACHE_KEY,
  RATE_TABLE_TTL_SECONDS,
} from '../products.constants.js';
import { RatesService } from '../rates.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

const CACHED: RateTable = {
  effectiveFrom: NOW.toISOString(),
  savings: [{ productCode: 'ICB-SAVINGS', name: 'ICB Reserve Savings', rate: 4.15 }],
  deposits: [],
  loans: [],
};

function doc(overrides: Partial<ProductDoc> = {}): ProductDoc {
  return {
    code: 'ICB-SAVINGS',
    name: 'ICB Reserve Savings',
    kind: 'savings',
    currencies: ['USD'],
    interestRate: 4.15,
    rateSchedule: [],
    depositTerms: [],
    loanRateRange: null,
    ...overrides,
  } as ProductDoc;
}

function setup({ cached }: { cached: RateTable | null }) {
  const model = { find: vi.fn() };
  const cache = { get: vi.fn().mockResolvedValue(cached), set: vi.fn(), delete: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new RatesService(
    model as unknown as Model<ProductDoc>,
    cache as unknown as CacheService,
    clock,
  );
  return { model, cache, service };
}

describe('getRateTable', () => {
  it('serves the cached table without touching the database', async () => {
    const { model, cache, service } = setup({ cached: CACHED });

    const table = await service.getRateTable();

    expect(table).toEqual(CACHED);
    expect(cache.get).toHaveBeenCalledWith(CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY, rateTableSchema);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('builds, caches, and returns the table on a miss', async () => {
    const { model, cache, service } = setup({ cached: null });
    model.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([doc()]) });

    const table = await service.getRateTable();

    expect(model.find).toHaveBeenCalledWith({ active: true });
    expect(table.savings).toEqual([
      { productCode: 'ICB-SAVINGS', name: 'ICB Reserve Savings', rate: 4.15 },
    ]);
    expect(cache.set).toHaveBeenCalledWith(
      CACHE_NAMESPACE,
      RATE_TABLE_CACHE_KEY,
      table,
      RATE_TABLE_TTL_SECONDS,
    );
  });
});

describe('invalidate', () => {
  it('deletes the rates cache key', async () => {
    const { cache, service } = setup({ cached: null });

    await service.invalidate();

    expect(cache.delete).toHaveBeenCalledWith(CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY);
  });
});
