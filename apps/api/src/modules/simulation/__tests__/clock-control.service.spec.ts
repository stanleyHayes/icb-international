import type { AdvanceClockRequest } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type EndOfDayService } from '../../../simulation/eod/end-of-day.service.js';
import { ClockControlService } from '../clock-control.service.js';
import { type SimulationStateService } from '../simulation-state.service.js';
import { NOW } from './fixtures.js';

const HOUR = 3_600_000;

function setup(start: Date = NOW) {
  const clock = new ClockService();
  clock.freeze(start);
  const state = { persistClock: vi.fn().mockResolvedValue(undefined) };
  const endOfDay = { run: vi.fn().mockResolvedValue({}) };

  const service = new ClockControlService(
    clock,
    state as unknown as SimulationStateService,
    endOfDay as unknown as EndOfDayService,
  );
  return { service, clock, state, endOfDay };
}

function runDates(endOfDay: { run: ReturnType<typeof vi.fn> }): string[] {
  return endOfDay.run.mock.calls.map(([date]) => date as string);
}

describe('ClockControlService.current', () => {
  it('reports the frozen clock and the business calendar around it', () => {
    const { service } = setup();

    expect(service.current()).toEqual({
      now: NOW.toISOString(),
      offsetMs: 0,
      frozen: true,
      businessDate: '2026-08-04',
      isBusinessDay: true,
      nextBusinessDate: '2026-08-05',
    });
  });
});

describe('ClockControlService.advance', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('moves by a duration without closing days when the jump stays inside one day', async () => {
    const state = await deps.service.advance({ duration: 'PT6H', runEndOfDay: true });

    expect(deps.endOfDay.run).not.toHaveBeenCalled();
    expect(state.now).toBe(new Date(NOW.getTime() + 6 * HOUR).toISOString());
    expect(deps.state.persistClock).toHaveBeenCalledTimes(1);
  });

  it('closes each business day crossed, at that day, before landing on the target', async () => {
    const state = await deps.service.advance({ to: '2026-08-07T10:00:00.000Z', runEndOfDay: true });

    expect(runDates(deps.endOfDay)).toEqual(['2026-08-04', '2026-08-05', '2026-08-06']);
    expect(state.now).toBe('2026-08-07T10:00:00.000Z');
    expect(deps.state.persistClock).toHaveBeenCalledTimes(1);
  });

  it('skips the end-of-day pipeline entirely when asked not to run it', async () => {
    await deps.service.advance({ to: '2026-08-07T10:00:00.000Z', runEndOfDay: false });

    expect(deps.endOfDay.run).not.toHaveBeenCalled();
    expect(deps.clock.now().toISOString()).toBe('2026-08-07T10:00:00.000Z');
  });

  it('closes neither weekends nor bank holidays', async () => {
    // Friday 18 September to Tuesday 22 September: a weekend and a holiday lie between.
    const { service, endOfDay } = setup(new Date('2026-09-18T10:00:00.000Z'));

    await service.advance({ to: '2026-09-22T10:00:00.000Z', runEndOfDay: true });

    expect(runDates(endOfDay)).toEqual(['2026-09-18']);
  });

  it('caps the batch runs on a multi-year jump instead of running for minutes', async () => {
    await deps.service.advance({ to: '2028-08-04T10:00:00.000Z', runEndOfDay: true });

    expect(deps.endOfDay.run).toHaveBeenCalledTimes(366);
    expect(deps.clock.now().toISOString()).toBe('2028-08-04T10:00:00.000Z');
  });

  it('refuses to move the clock backwards', async () => {
    await expect(
      deps.service.advance({ to: '2026-08-01T10:00:00.000Z', runEndOfDay: true }),
    ).rejects.toThrow(ValidationError);

    expect(deps.endOfDay.run).not.toHaveBeenCalled();
    expect(deps.state.persistClock).not.toHaveBeenCalled();
    expect(deps.clock.now().toISOString()).toBe(NOW.toISOString());
  });

  it('demands one of duration or to', async () => {
    const request = { runEndOfDay: false } as AdvanceClockRequest;

    await expect(deps.service.advance(request)).rejects.toThrow(ValidationError);
    expect(deps.state.persistClock).not.toHaveBeenCalled();
  });
});

describe('ClockControlService.set', () => {
  it('jumps to an absolute instant and freezes there', async () => {
    const deps = setup();

    const state = await deps.service.set({ to: '2027-01-15T00:00:00.000Z', frozen: true });

    expect(state.now).toBe('2027-01-15T00:00:00.000Z');
    expect(state.frozen).toBe(true);
    expect(deps.state.persistClock).toHaveBeenCalledTimes(1);
  });

  it('unfreezes without moving the clock', async () => {
    const deps = setup();

    const state = await deps.service.set({ frozen: false });

    expect(state.frozen).toBe(false);
    expect(deps.clock.isFrozen()).toBe(false);
    expect(deps.state.persistClock).toHaveBeenCalledTimes(1);
  });

  it('persists even when nothing changed', async () => {
    const deps = setup();

    const state = await deps.service.set({});

    expect(state.now).toBe(NOW.toISOString());
    expect(deps.state.persistClock).toHaveBeenCalledTimes(1);
  });
});

describe('ClockControlService.reset', () => {
  it('returns the clock to real time and persists that', async () => {
    const deps = setup();

    const state = await deps.service.reset();

    expect(state.offsetMs).toBe(0);
    expect(state.frozen).toBe(false);
    expect(deps.clock.getOffsetMs()).toBe(0);
    expect(deps.state.persistClock).toHaveBeenCalledTimes(1);
  });
});
