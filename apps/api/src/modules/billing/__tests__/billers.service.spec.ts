import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { BillersService } from '../billers.service.js';
import { BILLER_DIRECTORY, BILLER_LOGO_BASE_URL } from '../domain/biller-directory.js';
import type { BillerDoc } from '../infrastructure/biller.schemas.js';
import { BILLER_ID, billerDoc, chainQuery } from './fixtures.js';

const CONFIG = { bank: { baseCurrency: 'GBP' } } as unknown as AppConfiguration;

function setup(rows: BillerDoc[] = [billerDoc()]) {
  const model = {
    updateOne: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
    find: vi.fn().mockReturnValue(chainQuery(rows)),
    findById: vi.fn().mockReturnValue(chainQuery(rows[0] ?? null)),
  };
  const service = new BillersService(model as unknown as Model<BillerDoc>, CONFIG);
  return { service, model };
}

describe('BillersService.seedDirectory', () => {
  it('upserts every directory entry on its stable code with the configured currency', async () => {
    const { service, model } = setup();

    await service.seedDirectory();

    expect(model.updateOne).toHaveBeenCalledTimes(BILLER_DIRECTORY.length);
    const first = BILLER_DIRECTORY[0];
    expect(first).toBeDefined();
    expect(model.updateOne).toHaveBeenNthCalledWith(
      1,
      { code: first?.code },
      {
        $set: expect.objectContaining({
          name: first?.name,
          category: first?.category,
          logoUrl: `${BILLER_LOGO_BASE_URL}${first?.code.toLowerCase()}.svg`,
          currency: 'GBP',
          active: true,
        }),
        $setOnInsert: { _id: expect.any(String) },
      },
      { upsert: true },
    );
  });

  it('seeds on module init', async () => {
    const { service, model } = setup();

    await service.onModuleInit();

    expect(model.updateOne).toHaveBeenCalledTimes(BILLER_DIRECTORY.length);
  });
});

describe('BillersService.list', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('filters to active billers by default and maps the page', async () => {
    const result = await deps.service.list({ limit: 20 });

    expect(deps.model.find).toHaveBeenCalledWith({ active: true });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: BILLER_ID,
      name: 'National Grid Power — Postpaid',
      minimumAmount: { minorUnits: 500, currency: 'GBP', scale: 2 },
    });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('applies cursor, category and an escaped name search', async () => {
    await deps.service.list({ limit: 10, cursor: '01CURSOR', category: 'water', q: 'a.b*c' });

    expect(deps.model.find).toHaveBeenCalledWith({
      active: true,
      _id: { $gt: '01CURSOR' },
      category: 'water',
      name: { $regex: String.raw`a\.b\*c`, $options: 'i' },
    });
  });

  it('fetches one extra row and exposes the last id as the next cursor', async () => {
    const rows = [billerDoc({ _id: 'b1' }), billerDoc({ _id: 'b2' }), billerDoc({ _id: 'b3' })];
    const { service, model } = setup(rows);

    const result = await service.list({ limit: 2 });

    expect(model.find).toHaveBeenCalledWith({ active: true });
    expect(result.items.map((item) => item.id)).toEqual(['b1', 'b2']);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('b2');
  });
});

describe('BillersService.get', () => {
  it('returns the biller document when it exists', async () => {
    const { service } = setup();

    await expect(service.get(BILLER_ID)).resolves.toEqual(billerDoc());
  });

  it('throws a typed not-found for an unknown biller', async () => {
    const model = { findById: vi.fn().mockReturnValue(chainQuery(null)) };
    const service = new BillersService(model as unknown as Model<BillerDoc>, CONFIG);

    await expect(service.get('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('BillersService.requireActive', () => {
  it('returns an active biller', async () => {
    const { service } = setup();

    await expect(service.requireActive(BILLER_ID)).resolves.toEqual(billerDoc());
  });

  it('refuses a withdrawn biller with a conflict', async () => {
    const model = {
      findById: vi.fn().mockReturnValue(chainQuery(billerDoc({ active: false }))),
    };
    const service = new BillersService(model as unknown as Model<BillerDoc>, CONFIG);

    await expect(service.requireActive(BILLER_ID)).rejects.toThrow(ConflictError);
  });
});

describe('BillersService.findByIds', () => {
  it('returns the found billers keyed by id', async () => {
    const rows = [billerDoc({ _id: 'b1' }), billerDoc({ _id: 'b2' })];
    const { service, model } = setup(rows);

    const result = await service.findByIds(['b1', 'b2', 'b3']);

    expect(model.find).toHaveBeenCalledWith({ _id: { $in: ['b1', 'b2', 'b3'] } });
    expect(result.get('b1')?._id).toBe('b1');
    expect(result.get('b2')?._id).toBe('b2');
    expect(result.has('b3')).toBe(false);
  });
});
