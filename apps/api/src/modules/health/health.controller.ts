import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { Public } from '../../common/decorators/public.decorator.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { Inject } from '@nestjs/common';
import { ClockService } from '../../simulation/clock/clock.service.js';

/**
 * Liveness and readiness.
 *
 * `/health` answers "is the process up" and must never touch a dependency — a slow database
 * should not get the container killed. `/health/ready` answers "can it serve traffic" and does.
 */
@Public()
@Controller('health')
export class HealthController {
  private readonly startedAtMs: number;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {
    this.startedAtMs = clock.epochMs();
  }

  @Get()
  live(): { status: string; uptimeSeconds: number; bank: string } {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((this.clock.epochMs() - this.startedAtMs) / 1000),
      bank: this.config.bank.name,
    };
  }

  @Get('ready')
  ready(): {
    status: 'ready' | 'not_ready';
    database: string;
    simulatedNow: string;
    businessDate: string;
  } {
    // Mongoose exposes readyState as a numeric enum; 1 is "connected".
    const connected = Number(this.connection.readyState) === 1;
    const database = connected ? 'connected' : 'disconnected';
    return {
      status: connected ? 'ready' : 'not_ready',
      database,
      simulatedNow: this.clock.now().toISOString(),
      businessDate: this.clock.today(),
    };
  }
}
