import type { SystemHealth } from '@icb/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SystemHealthService } from './system-health.service.js';

/**
 * Component-level health for the operations console.
 *
 * Role-gated, unlike the public `/health` liveness probe: queue depths and component detail
 * are operational internals, not something to hand to the internet.
 */
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('operations', 'compliance', 'admin', 'super_admin')
export class SystemHealthController {
  constructor(private readonly health: SystemHealthService) {}

  @Get('health')
  async healthCheck(): Promise<SystemHealth> {
    return this.health.check();
  }
}
