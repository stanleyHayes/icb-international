import type { SystemHealth } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';

type ComponentHealth = SystemHealth['components'][number];
type HealthStatus = SystemHealth['status'];

/** Mongoose exposes readyState as a numeric enum; 1 is "connected". */
const MONGOOSE_CONNECTED = 1;
const MS_PER_SECOND = 1_000;
/** Used when the process was not started through npm and no version is in the environment. */
const DEFAULT_VERSION = '0.0.0';

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Mongodb down is a hard failure; anything else merely not healthy degrades the service. */
function overallStatus(components: readonly ComponentHealth[]): HealthStatus {
  if (components.some((component) => component.name === 'mongodb' && component.status === 'down')) {
    return 'down';
  }
  return components.every((component) => component.status === 'healthy') ? 'healthy' : 'degraded';
}

/**
 * Dependency probe for the operations console.
 *
 * Unlike `/health` (process liveness, no dependencies) this answers "how is the bank doing":
 * it pings MongoDB, so a console operator sees a slow or unreachable database before customers
 * do. MongoDB is the only external dependency left — the queues and their Redis broker were
 * removed, so `queues` is reported empty rather than dropped, keeping the contract stable for
 * the console.
 */
@Injectable()
export class SystemHealthService {
  private readonly startedAtMs: number;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly clock: ClockService,
  ) {
    this.startedAtMs = clock.epochMs();
  }

  async check(): Promise<SystemHealth> {
    const mongodb = await this.checkMongodb();

    return {
      status: overallStatus([mongodb]),
      components: [mongodb],
      queues: [],
      uptimeSeconds: Math.floor((this.clock.epochMs() - this.startedAtMs) / MS_PER_SECOND),
      // Configuration carries no version field; the package version is the build stamp.
      version: process.env['npm_package_version'] ?? DEFAULT_VERSION,
      checkedAt: this.clock.now().toISOString(),
    };
  }

  /** readyState first, then a real ping so a half-open connection cannot masquerade as healthy. */
  private async checkMongodb(): Promise<ComponentHealth> {
    if (Number(this.connection.readyState) !== MONGOOSE_CONNECTED) {
      return {
        name: 'mongodb',
        status: 'down',
        latencyMs: null,
        detail: 'Mongoose connection is not established',
      };
    }
    const db = this.connection.db;
    if (!db) {
      return { name: 'mongodb', status: 'down', latencyMs: null, detail: 'No database handle' };
    }
    const startedMs = this.clock.epochMs();
    try {
      await db.admin().ping();
      return {
        name: 'mongodb',
        status: 'healthy',
        latencyMs: this.clock.epochMs() - startedMs,
        detail: null,
      };
    } catch (error) {
      return { name: 'mongodb', status: 'down', latencyMs: null, detail: errorDetail(error) };
    }
  }
}
