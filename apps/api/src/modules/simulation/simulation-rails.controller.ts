import { updateRailProfileRequestSchema, type RailProfile } from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { RailRegistry, type RailProfilePatch } from '../../simulation/rails/rail.registry.js';
import { toSimulationRail } from './infrastructure/simulation.mapper.js';

/**
 * The rail profile editor.
 *
 * This is how a failure path gets demonstrated on demand: set ACH's failure rate to 1, send a
 * payment, and watch the return code arrive. The rail name is narrowed from the path rather than
 * trusted, so an unknown rail is a 404 instead of a silently created phantom profile.
 */
@Controller('simulation')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class SimulationRailsController {
  constructor(private readonly rails: RailRegistry) {}

  @Get('rails')
  async list(): Promise<{ items: RailProfile[] }> {
    return { items: await this.rails.profiles() };
  }

  @Patch('rails/:rail')
  async update(
    @Param('rail') rail: string,
    @Body(zodBody(updateRailProfileRequestSchema)) body: RailProfilePatch,
  ): Promise<RailProfile> {
    return this.rails.updateProfile(toSimulationRail(rail), body);
  }
}
