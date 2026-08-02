import type { SimulationState } from '@icb/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SimulationService } from './simulation.service.js';

/**
 * The simulation control room.
 *
 * `super_admin` only, and never surfaced to a customer: the retail product has no idea it is a
 * simulation, and the moment these routes are reachable from the customer app that illusion — and
 * the point of the whole exercise — is gone.
 */
@Controller('simulation')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Get('state')
  async state(): Promise<SimulationState> {
    return this.simulation.snapshot();
  }
}
