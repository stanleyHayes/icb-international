import type { RateTable } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import type { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { ProductDoc } from '../../products/infrastructure/product.schemas.js';
import { ContentRatesService } from '../application/content-rates.service.js';
import { overlayRateEntries, type RateOverlayEntry } from '../domain/rate-overlay.js';
import type { ContentRateEntryDoc } from '../infrastructure/content.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const PAST = new Date('2026-07-01T00:00:00.000Z');
const FUTURE = new Date('2026-09-01T00:00:00.000Z');
const STAFF = { sub: 'staff-1' } as AccessTokenClaims;

function entry(productCode: string, rate: number, effectiveFrom: Date): RateOverlayEntry {
  return { productCode, name: productCode, rate, effectiveFrom };
}

function baseTable(): RateTable {
  return {
    effectiveFrom: PAST.toISOString(),
    savings: [{ productCode: 'savings-everyday', name: 'Everyday Savings', rate: 3.5 }],
    deposits: [],
    loans: [],
  };
}

describe('overlayRateEntries', () => {
  it('replaces the rate of a product code already in the table', () => {
    const layered = overlayRateEntries(baseTable(), [entry('savings-everyday', 4.25, PAST)], NOW);
    expect(layered.savings).toEqual([
      { productCode: 'savings-everyday', name: 'Everyday Savings', rate: 4.25 },
    ]);
  });

  it('appends a code the catalogue does not publish', () => {
    const layered = overlayRateEntries(baseTable(), [entry('promo-youth', 6.0, PAST)], NOW);
    expect(layered.savings).toHaveLength(2);
    expect(layered.savings[1]).toEqual({ productCode: 'promo-youth', name: 'promo-youth', rate: 6.0 });
  });

  it('ignores entries whose effective date has not arrived', () => {
    const layered = overlayRateEntries(baseTable(), [entry('savings-everyday', 9.9, FUTURE)], NOW);
    expect(layered).toEqual(baseTable());
  });

  it('advances effectiveFrom to the newest applied entry', () => {
    const applied = new Date('2026-07-15T00:00:00.000Z');
    const layered = overlayRateEntries(baseTable(), [entry('promo-youth', 6.0, applied)], NOW);
    expect(layered.effectiveFrom).toBe(applied.toISOString());
  });

  it('does not mutate the base table', () => {
    const table = baseTable();
    overlayRateEntries(table, [entry('savings-everyday', 4.25, PAST)], NOW);
    expect(table.savings[0]?.rate).toBe(3.5);
  });
});

function entryDoc(overrides: Partial<ContentRateEntryDoc> = {}): ContentRateEntryDoc {
  return {
    _id: 'rate-1',
    productCode: 'savings-everyday',
    name: 'Everyday Savings',
    rate: 4.25,
    effectiveFrom: PAST,
    createdBy: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup() {
  const entries = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([entryDoc()]) })),
      lean: vi.fn().mockResolvedValue([entryDoc()]),
    })),
    findOneAndUpdate: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(entryDoc()) })),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const products = {
    find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })),
  };
  const cache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new ContentRatesService(
    entries as unknown as Model<ContentRateEntryDoc>,
    products as unknown as Model<ProductDoc>,
    cache as unknown as CacheService,
    clock,
  );
  return { service, entries, cache };
}

describe('ContentRatesService', () => {
  it('serves the cached table when present', async () => {
    const { service, cache, entries } = setup();
    cache.get.mockResolvedValue(baseTable());
    const table = await service.getLayeredRateTable();
    expect(table).toEqual(baseTable());
    expect(entries.find).not.toHaveBeenCalled();
  });

  it('layers entries over the catalogue table and caches the result', async () => {
    const { service, cache } = setup();
    const table = await service.getLayeredRateTable();
    expect(table.savings).toEqual([
      { productCode: 'savings-everyday', name: 'Everyday Savings', rate: 4.25 },
    ]);
    expect(cache.set).toHaveBeenCalledWith('content', 'rate-table', table, 300);
  });

  it('upserts by product code and invalidates the cache', async () => {
    const { service, entries, cache } = setup();
    const view = await service.upsert(STAFF, {
      productCode: 'savings-everyday',
      name: 'Everyday Savings',
      rate: 4.25,
      effectiveFrom: PAST.toISOString(),
    });
    const [filter] = entries.findOneAndUpdate.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(filter).toEqual({ productCode: 'savings-everyday' });
    expect(view.rate).toBe(4.25);
    expect(cache.delete).toHaveBeenCalledWith('content', 'rate-table');
  });

  it('throws NotFoundError when deleting a missing entry', async () => {
    const { service, entries } = setup();
    entries.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
