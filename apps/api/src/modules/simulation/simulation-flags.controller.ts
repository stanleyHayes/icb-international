import { updateFeatureFlagRequestSchema, type FeatureFlag } from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { FeatureFlagsService, type FeatureFlagPatch } from './feature-flags.service.js';

/**
 * Runtime feature flags.
 *
 * Both spellings of the path are served — `/flags` and `/feature-flags` — because the SDK and the
 * OpenAPI document disagree, and an operator hitting the wrong one during an incident should get
 * the flag rather than a 404.
 */
@Controller('simulation')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class SimulationFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get('flags')
  async list(): Promise<{ items: FeatureFlag[] }> {
    return { items: await this.flags.list() };
  }

  @Get('feature-flags')
  async listAlias(): Promise<{ items: FeatureFlag[] }> {
    return { items: await this.flags.list() };
  }

  @Patch('flags/:key')
  async update(
    @Param('key') key: string,
    @Body(zodBody(updateFeatureFlagRequestSchema)) body: FeatureFlagPatch,
  ): Promise<FeatureFlag> {
    return this.flags.update(key, body);
  }

  @Patch('feature-flags/:key')
  async updateAlias(
    @Param('key') key: string,
    @Body(zodBody(updateFeatureFlagRequestSchema)) body: FeatureFlagPatch,
  ): Promise<FeatureFlag> {
    return this.flags.update(key, body);
  }
}
