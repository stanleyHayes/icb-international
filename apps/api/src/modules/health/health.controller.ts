import type { LedgerIntegrityReport } from '@icb/contracts';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { FastifyReply } from 'fastify';
import type { Connection } from 'mongoose';

import { Public } from '../../common/decorators/public.decorator.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { Inject } from '@nestjs/common';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { LedgerHealthService } from './ledger-health.service.js';

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
    private readonly ledgerHealth: LedgerHealthService,
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
  ready(@Res({ passthrough: true }) reply: FastifyReply): {
    status: 'ready' | 'not_ready';
    database: string;
    serverTime: string;
    businessDate: string;
  } {
    // Mongoose exposes readyState as a numeric enum; 1 is "connected".
    const connected = Number(this.connection.readyState) === 1;

    // The status code is the answer, not the body: Render's `healthCheckPath` and the compose
    // health check both gate on it, and a 200 here keeps traffic on an instance whose every
    // request will 500. 503 is what the route contract has always declared for this case.
    reply.status(connected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: connected ? 'ready' : 'not_ready',
      database: connected ? 'connected' : 'disconnected',
      serverTime: this.clock.now().toISOString(),
      businessDate: this.clock.today(),
    };
  }

  @Get('ledger')
  ledger(): Promise<LedgerIntegrityReport> {
    // Cached for a minute inside the service — the aggregation is expensive and a probe
    // polling every few seconds has no use for a fresher answer.
    return this.ledgerHealth.report();
  }
}
