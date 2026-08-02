import { runScenarioRequestSchema, type Scenario, type ScenarioRun } from '@icb/contracts';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { scenarioCatalogue } from '../../simulation/scenarios/scenario.catalogue.js';
import { ScenarioRunner } from '../../simulation/scenarios/scenario.runner.js';

type RunScenarioRequest = z.infer<typeof runScenarioRequestSchema>;

/**
 * The scenario runner.
 *
 * A run is synchronous: the response is the finished run, not a promise of one. An operator who
 * pressed "payday" wants to refresh the dashboard and see payday, and a background job that
 * failed halfway would leave them looking at a half-built bank with no explanation.
 */
@Controller('simulation')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class SimulationScenariosController {
  constructor(private readonly scenarios: ScenarioRunner) {}

  @Get('scenarios')
  list(): { items: Scenario[] } {
    return { items: scenarioCatalogue() };
  }

  @Post('scenarios/run')
  async run(
    @Body(zodBody(runScenarioRequestSchema)) body: RunScenarioRequest,
  ): Promise<ScenarioRun> {
    return this.scenarios.run(toCommand(body));
  }

  /** The plural spelling the generated SDK uses for the same operation. */
  @Post('scenarios/runs')
  async runAlias(
    @Body(zodBody(runScenarioRequestSchema)) body: RunScenarioRequest,
  ): Promise<ScenarioRun> {
    return this.scenarios.run(toCommand(body));
  }

  @Get('scenarios/runs/:runId')
  async getRun(@Param('runId') runId: string): Promise<ScenarioRun> {
    return this.scenarios.get(runId);
  }
}

/** The seed is omitted rather than passed as undefined, so the runner can derive its own. */
function toCommand(body: RunScenarioRequest) {
  return {
    name: body.name,
    intensity: body.intensity,
    ...(body.seed === undefined ? {} : { seed: body.seed }),
  };
}
