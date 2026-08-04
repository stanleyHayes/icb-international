import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DEFAULT_SPREAD_BPS } from '../domain/fx-spread.js';
import { midRateAt } from '../domain/rate-drift.js';
import { FxRatesService } from '../fx-rates.service.js';
import type { FxRateDoc } from '../infrastructure/fx.schemas.js';

const SEED = 'test-seed';
const NOW = new Date('2026-08-04T10:00:00.000Z');

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

function setup() {
  const model = {
    bulkWrite: vi.fn().mockResolvedValue({ upsertedCount: 0 }),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const config = {
    simulation: { seed: SEED },
  } as unknown as AppConfiguration;
  const clock = frozenClock();
  const service = new FxRatesService(model as unknown as Model<FxRateDoc>, config, clock);
  return { service, model, clock };
}

describe('FxRatesService.seed', () => {
  it('writes the whole board on boot and records the refresh instant', async () => {
    const { service, model } = setup();

    await service.onModuleInit();

    expect(model.bulkWrite).toHaveBeenCalledTimes(1);
    const [operations] = model.bulkWrite.mock.calls[0] as [unknown[]];
    expect(operations).toHaveLength(210);
  });

  it('seeds at the standard spread', async () => {
    const { service } = setup();
    await service.seed();

    const board = await service.list();
    expect(board[0]?.spreadBps).toBe(DEFAULT_SPREAD_BPS);
  });
});

describe('FxRatesService.list', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(async () => {
    deps = setup();
    await deps.service.seed();
    deps.model.bulkWrite.mockClear();
  });

  it('quotes every ordered pair and skips a refresh inside the one-minute window', async () => {
    const board = await deps.service.list();

    expect(board).toHaveLength(210);
    expect(board.every((rate) => rate.base !== rate.quote)).toBe(true);
    expect(deps.model.bulkWrite).not.toHaveBeenCalled();
  });

  it('refreshes the persisted board once the clock has moved past the interval', async () => {
    deps.clock.advance(61_000);

    await deps.service.list();

    expect(deps.model.bulkWrite).toHaveBeenCalledTimes(1);
  });

  it('honours a caller-supplied spread', async () => {
    const board = await deps.service.list(25);
    expect(board[0]?.spreadBps).toBe(25);
  });
});

describe('FxRatesService.get', () => {
  it('upserts the single pair it computed', async () => {
    const { service, model } = setup();
    const rate = await service.get({ base: 'EUR', quote: 'USD' });

    expect(rate.pair).toBe('EUR/USD');
    expect(rate.mid).toBe(midRateAt(SEED, 'EUR', 'USD', NOW.getTime()));
    expect(model.updateOne).toHaveBeenCalledWith(
      { pair: 'EUR/USD' },
      expect.objectContaining({ $set: expect.objectContaining({ pair: 'EUR/USD' }) }),
      { upsert: true },
    );
  });

  it('parses a path segment before looking up', async () => {
    const { service } = setup();
    const rate = await service.getByKey('gbp-usd', 45);
    expect(rate.pair).toBe('GBP/USD');
    expect(rate.spreadBps).toBe(45);
  });
});

describe('FxRatesService.history', () => {
  it('returns evenly spaced instants ending at now, oldest first', () => {
    const { service } = setup();
    const series = service.history({ base: 'EUR', quote: 'USD' });

    expect(series).toHaveLength(24);
    expect(series.at(-1)?.effectiveAt).toBe(NOW.toISOString());
    expect(new Date(series[0]!.effectiveAt).getTime()).toBeLessThan(new Date(series[1]!.effectiveAt).getTime());
  });

  it('falls back to defaults when no options are given and respects overrides', () => {
    const { service } = setup();

    expect(service.history({ base: 'EUR', quote: 'USD' })).toHaveLength(24);
    expect(service.history({ base: 'EUR', quote: 'USD' }, { points: 4, hours: 2 })).toHaveLength(4);
    const custom = service.history({ base: 'EUR', quote: 'USD' }, { spreadBps: 25 });
    expect(custom[0]?.spreadBps).toBe(25);
  });
});

describe('FxRatesService.midFor', () => {
  it('is pure with respect to the database and defaults to the clock', () => {
    const { service, model } = setup();
    const mid = service.midFor('EUR', 'USD');

    expect(mid).toBe(midRateAt(SEED, 'EUR', 'USD', NOW.getTime()));
    expect(model.bulkWrite).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('accepts an explicit instant', () => {
    const { service } = setup();
    const at = new Date(NOW.getTime() - 3_600_000);
    expect(service.midFor('EUR', 'USD', at)).toBe(midRateAt(SEED, 'EUR', 'USD', at.getTime()));
  });
});
