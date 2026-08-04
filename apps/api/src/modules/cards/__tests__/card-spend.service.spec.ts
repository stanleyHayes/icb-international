import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CardSpendService, type SpendWindow } from '../application/card-spend.service.js';
import { defaultLimits } from '../domain/card-defaults.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { CARD_ID, NOW } from './fixtures.js';

const DAY_START = new Date('2026-08-02T00:00:00.000Z');
const MONTH_START = new Date('2026-08-01T00:00:00.000Z');
const COUNTED = { $in: ['approved', 'captured'] };

/** Each entry is one `aggregate()` result set — Mongo returns rows, not bare numbers. */
function setup(totals: { total: number }[][]) {
  const model = {
    aggregate: vi
      .fn()
      .mockResolvedValueOnce(totals[0] ?? [])
      .mockResolvedValueOnce(totals[1] ?? [])
      .mockResolvedValueOnce(totals[2] ?? []),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new CardSpendService(
    model as unknown as Model<CardAuthorisationDoc>,
    clock,
  );
  return { service, model };
}

function matchCalledWith(model: { aggregate: ReturnType<typeof vi.fn> }, index: number) {
  const pipeline = model.aggregate.mock.calls[index]?.[0] as { $match: unknown }[];
  return pipeline[0]?.$match;
}

describe('CardSpendService.windowFor', () => {
  it('aggregates approved and captured authorisations in the day, month and ATM windows', async () => {
    const { service, model } = setup([[{ total: 12_000 }], [{ total: 340_000 }], [{ total: 5_000 }]]);

    const window = await service.windowFor(CARD_ID);

    expect(matchCalledWith(model, 0)).toEqual({
      cardId: CARD_ID,
      status: COUNTED,
      authorisedAt: { $gte: DAY_START },
    });
    expect(matchCalledWith(model, 1)).toEqual({
      cardId: CARD_ID,
      status: COUNTED,
      authorisedAt: { $gte: MONTH_START },
    });
    expect(matchCalledWith(model, 2)).toEqual({
      cardId: CARD_ID,
      status: COUNTED,
      channel: 'atm',
      authorisedAt: { $gte: DAY_START },
    });
    expect(window).toEqual({
      todayMinorUnits: 12_000,
      monthMinorUnits: 340_000,
      atmTodayMinorUnits: 5_000,
    });
  });

  it('reports zero for a window with no authorisations at all', async () => {
    const { service } = setup([[], [], []]);

    await expect(service.windowFor(CARD_ID)).resolves.toEqual({
      todayMinorUnits: 0,
      monthMinorUnits: 0,
      atmTodayMinorUnits: 0,
    });
  });
});

describe('CardSpendService.toSpendDto', () => {
  const { service } = setup([[], [], []]);
  const limits = defaultLimits('debit');

  it('reports spend and the headroom left in each window', () => {
    const window: SpendWindow = {
      todayMinorUnits: 12_000,
      monthMinorUnits: 340_000,
      atmTodayMinorUnits: 5_000,
    };

    const dto = service.toSpendDto(window, limits, 'USD');

    expect(dto.todaySpent).toEqual(expect.objectContaining({ minorUnits: 12_000 }));
    expect(dto.monthSpent).toEqual(expect.objectContaining({ minorUnits: 340_000 }));
    expect(dto.dailyRemaining).toEqual(
      expect.objectContaining({ minorUnits: limits.dailyMinorUnits - 12_000 }),
    );
    expect(dto.monthlyRemaining).toEqual(
      expect.objectContaining({ minorUnits: limits.monthlyMinorUnits - 340_000 }),
    );
  });

  it('clamps the remaining headroom at zero for an over-limit card', () => {
    const window: SpendWindow = {
      todayMinorUnits: limits.dailyMinorUnits + 1,
      monthMinorUnits: limits.monthlyMinorUnits + 1,
      atmTodayMinorUnits: 0,
    };

    const dto = service.toSpendDto(window, limits, 'USD');

    expect(dto.dailyRemaining).toEqual(expect.objectContaining({ minorUnits: 0 }));
    expect(dto.monthlyRemaining).toEqual(expect.objectContaining({ minorUnits: 0 }));
  });
});
