import type { ClockState } from '@icb/contracts';
import { describe, expect, it, vi } from 'vitest';

import { type RailRegistry } from '../../../simulation/rails/rail.registry.js';
import { type ScenarioRunner } from '../../../simulation/scenarios/scenario.runner.js';
import { type ClockControlService } from '../clock-control.service.js';
import { type SimulationStateService } from '../simulation-state.service.js';
import { SimulationService } from '../simulation.service.js';
import { NOW, railProfile, scenarioRun } from './fixtures.js';

const CLOCK: ClockState = {
  now: NOW.toISOString(),
  offsetMs: 0,
  frozen: true,
  businessDate: '2026-08-04',
  isBusinessDay: true,
  nextBusinessDate: '2026-08-05',
};

function setup(seededAt: Date | null = NOW) {
  const clockControl = { current: vi.fn().mockReturnValue(CLOCK) };
  const rails = { profiles: vi.fn().mockResolvedValue([railProfile()]) };
  const scenarios = { latest: vi.fn().mockResolvedValue(scenarioRun()) };
  const state = {
    chaos: vi.fn().mockResolvedValue({ enabled: true, databaseLatencyMs: 120, randomFailureRate: 0.25 }),
    seededAt: vi.fn().mockResolvedValue(seededAt),
  };

  const service = new SimulationService(
    clockControl as unknown as ClockControlService,
    rails as unknown as RailRegistry,
    scenarios as unknown as ScenarioRunner,
    state as unknown as SimulationStateService,
  );
  return { service, clockControl, rails, scenarios, state };
}

describe('SimulationService.snapshot', () => {
  it('assembles the whole control-room payload in one call', async () => {
    const { service } = setup();

    const snapshot = await service.snapshot();

    expect(snapshot).toEqual({
      clock: CLOCK,
      rails: [railProfile()],
      activeScenario: scenarioRun(),
      chaos: { enabled: true, databaseLatencyMs: 120, randomFailureRate: 0.25 },
      seededAt: NOW.toISOString(),
    });
  });

  it('reports null when the bank has never been seeded and no scenario has run', async () => {
    const { service, scenarios } = setup(null);
    scenarios.latest.mockResolvedValue(null);

    const snapshot = await service.snapshot();

    expect(snapshot.seededAt).toBeNull();
    expect(snapshot.activeScenario).toBeNull();
  });
});
