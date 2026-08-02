import type { SimulationState } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { RailRegistry } from '../../simulation/rails/rail.registry.js';
import { ScenarioRunner } from '../../simulation/scenarios/scenario.runner.js';
import { ClockControlService } from './clock-control.service.js';
import { SimulationStateService } from './simulation-state.service.js';

/**
 * The whole simulated world in one payload.
 *
 * The control room opens on this: what time the bank thinks it is, how each rail is behaving, what
 * scenario last ran, and whether chaos is on. Assembling it in one call means the screen cannot
 * show a clock from one moment and rails from another.
 */
@Injectable()
export class SimulationService {
  constructor(
    private readonly clockControl: ClockControlService,
    private readonly rails: RailRegistry,
    private readonly scenarios: ScenarioRunner,
    private readonly state: SimulationStateService,
  ) {}

  async snapshot(): Promise<SimulationState> {
    const [rails, activeScenario, chaos, seededAt] = await Promise.all([
      this.rails.profiles(),
      this.scenarios.latest(),
      this.state.chaos(),
      this.state.seededAt(),
    ]);

    return {
      clock: this.clockControl.current(),
      rails,
      activeScenario,
      chaos,
      seededAt: seededAt?.toISOString() ?? null,
    };
  }
}
