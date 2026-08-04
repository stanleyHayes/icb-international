import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { SIM_STATE_ID, type SimStateDoc } from '../infrastructure/simulation.schemas.js';
import { SimulationStateService } from '../simulation-state.service.js';
import { NOW, railProfile, simStateDoc, storedRailProfile } from './fixtures.js';

function leanQuery<T>(result: T) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

function setup(state: SimStateDoc | null = simStateDoc()) {
  const model = {
    findById: vi.fn().mockReturnValue(leanQuery(state)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new SimulationStateService(model as unknown as Model<SimStateDoc>, clock);
  return { service, model, clock };
}

describe('SimulationStateService.read', () => {
  it('returns the persisted singleton when it exists', async () => {
    const { service, model } = setup(simStateDoc({ chaosEnabled: true }));

    const state = await service.read();

    expect(model.findById).toHaveBeenCalledWith(SIM_STATE_ID);
    expect(model.updateOne).not.toHaveBeenCalled();
    expect(state.chaosEnabled).toBe(true);
  });

  it('creates the singleton on first read, then re-reads it', async () => {
    const { service, model } = setup();
    const created = simStateDoc({ clockOffsetMs: 3_600_000 });
    model.findById
      .mockReturnValueOnce(leanQuery(null))
      .mockReturnValueOnce(leanQuery(created));

    const state = await service.read();

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID },
      { $setOnInsert: { _id: SIM_STATE_ID } },
      { upsert: true },
    );
    expect(state.clockOffsetMs).toBe(3_600_000);
  });

  it('falls back to in-memory defaults when the document still cannot be read', async () => {
    const { service } = setup(null);

    const state = await service.read();

    expect(state).toEqual(simStateDoc());
  });
});

describe('SimulationStateService.onModuleInit', () => {
  it('restores a persisted offset and freeze into the clock', async () => {
    const { service, clock } = setup(simStateDoc({ clockOffsetMs: 86_400_000, clockFrozen: true }));

    await service.onModuleInit();

    expect(clock.getOffsetMs()).toBe(86_400_000);
    expect(clock.isFrozen()).toBe(true);
  });

  it('leaves the clock running true when nothing was ever persisted', async () => {
    const { service, clock } = setup(simStateDoc());

    await service.onModuleInit();

    expect(clock.getOffsetMs()).toBe(0);
    expect(clock.isFrozen()).toBe(false);
  });

  it('swallows a read failure so the bank still boots', async () => {
    const { service, model, clock } = setup();
    model.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('mongo down')) });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    // Nothing was restored, so the clock is exactly as `setup` left it — untouched, not reset.
    // Swallowing the failure means the bank boots; it does not mean the clock is reinterpreted.
    expect(clock.getOffsetMs()).toBe(0);
    expect(clock.isFrozen()).toBe(true);
  });
});

describe('SimulationStateService rail profiles', () => {
  it('maps every stored profile to the contract shape', async () => {
    const { service } = setup(simStateDoc({ railProfiles: [storedRailProfile()] }));

    await expect(service.railProfiles()).resolves.toEqual([railProfile()]);
  });

  it('updates an existing rail profile in place', async () => {
    const { service, model } = setup();

    await service.saveRailProfile(railProfile({ failureRate: 0.5 }));

    expect(model.updateOne).toHaveBeenCalledTimes(1);
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID, 'railProfiles.rail': 'ach' },
      { $set: { 'railProfiles.$': storedRailProfile({ failureRate: 0.5 }) } },
    );
  });

  it('pushes a profile the singleton has never stored', async () => {
    const { service, model } = setup();
    model.updateOne.mockResolvedValueOnce({ matchedCount: 0 });

    await service.saveRailProfile(railProfile());

    expect(model.updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: SIM_STATE_ID },
      { $push: { railProfiles: storedRailProfile() } },
      { upsert: true },
    );
  });

  it('pulls a rail profile back out on reset', async () => {
    const { service, model } = setup();

    await service.resetRailProfile('ach');

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID },
      { $pull: { railProfiles: { rail: 'ach' } } },
    );
  });
});

describe('SimulationStateService.persistClock', () => {
  it('writes the clock offset and freeze state, creating the document if needed', async () => {
    const { service, model, clock } = setup();
    clock.setTo(new Date(NOW.getTime() + 3_600_000));

    await service.persistClock();

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID },
      {
        $set: { clockOffsetMs: clock.getOffsetMs(), clockFrozen: true },
        $setOnInsert: { _id: SIM_STATE_ID },
      },
      { upsert: true },
    );
  });
});

describe('SimulationStateService chaos settings', () => {
  it('reads the chaos fields off the singleton', async () => {
    const { service } = setup(
      simStateDoc({ chaosEnabled: true, chaosDatabaseLatencyMs: 120, chaosRandomFailureRate: 0.25 }),
    );

    await expect(service.chaos()).resolves.toEqual({
      enabled: true,
      databaseLatencyMs: 120,
      randomFailureRate: 0.25,
    });
  });

  it('merges a partial change over the current settings', async () => {
    const { service, model } = setup(
      simStateDoc({ chaosEnabled: false, chaosDatabaseLatencyMs: 50, chaosRandomFailureRate: 0.1 }),
    );

    const next = await service.setChaos({ enabled: true });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID },
      {
        $set: {
          chaosEnabled: true,
          chaosDatabaseLatencyMs: 50,
          chaosRandomFailureRate: 0.1,
        },
      },
      { upsert: true },
    );
    expect(next).toEqual({ enabled: true, databaseLatencyMs: 50, randomFailureRate: 0.1 });
  });
});

describe('SimulationStateService scenario run pointer', () => {
  it('reads and writes the active scenario run id', async () => {
    const { service, model } = setup(simStateDoc({ activeScenarioRunId: 'run-9' }));

    await expect(service.activeScenarioRunId()).resolves.toBe('run-9');

    await service.setActiveScenarioRunId(null);
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID },
      { $set: { activeScenarioRunId: null } },
      { upsert: true },
    );
  });
});

describe('SimulationStateService seed marker', () => {
  it('reports null before the bank is seeded and stamps the clock time when it is', async () => {
    const { service, model } = setup();

    await expect(service.seededAt()).resolves.toBeNull();

    await service.markSeeded();
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: SIM_STATE_ID },
      { $set: { seededAt: NOW } },
      { upsert: true },
    );
  });
});
