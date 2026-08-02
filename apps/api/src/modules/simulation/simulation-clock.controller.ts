import {
  advanceClockRequestSchema,
  setClockRequestSchema,
  type AdvanceClockRequest,
  type ClockState,
} from '@icb/contracts';
import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { ClockControlService, type SetClockRequest } from './clock-control.service.js';

/**
 * Time travel.
 *
 * `set` is exposed as both POST `/clock/set` and PUT `/clock` because the generated SDK and the
 * admin console were written against different verbs for the same operation. One handler, two
 * routes — cheaper and safer than a client that silently 404s during a demo.
 */
@Controller('simulation')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class SimulationClockController {
  constructor(private readonly clock: ClockControlService) {}

  @Get('clock')
  clockState(): ClockState {
    return this.clock.current();
  }

  @Post('clock/advance')
  async advance(
    @Body(zodBody(advanceClockRequestSchema)) body: AdvanceClockRequest,
  ): Promise<ClockState> {
    return this.clock.advance(body);
  }

  @Post('clock/set')
  async set(@Body(zodBody(setClockRequestSchema)) body: SetClockRequest): Promise<ClockState> {
    return this.clock.set(body);
  }

  @Put('clock')
  async put(@Body(zodBody(setClockRequestSchema)) body: SetClockRequest): Promise<ClockState> {
    return this.clock.set(body);
  }

  @Post('clock/reset')
  async reset(): Promise<ClockState> {
    return this.clock.reset();
  }
}
