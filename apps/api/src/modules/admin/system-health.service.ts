import type { SystemHealth } from '@icb/contracts';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Queue } from 'bullmq';
import type { Connection } from 'mongoose';

import { DEAD_LETTER_QUEUE } from '../../infrastructure/queue/queue.constants.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { ACCRUALS_QUEUE } from '../accruals/accruals.constants.js';

type ComponentHealth = SystemHealth['components'][number];
type QueueHealth = SystemHealth['queues'][number];
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
 * it pings MongoDB and reads the BullMQ job counts, so a console operator sees a slow database
 * or a growing failed-job count before customers do. A dead Redis must not blank the page —
 * the queues section simply empties and the redis component reports degraded.
 */
@Injectable()
export class SystemHealthService {
  private readonly startedAtMs: number;
  private readonly monitoredQueues: ReadonlyArray<{ name: string; queue: Queue }>;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue(DEAD_LETTER_QUEUE) deadLetterQueue: Queue,
    @InjectQueue(ACCRUALS_QUEUE) accrualsQueue: Queue,
    private readonly clock: ClockService,
  ) {
    this.startedAtMs = clock.epochMs();
    this.monitoredQueues = [
      { name: DEAD_LETTER_QUEUE, queue: deadLetterQueue },
      { name: ACCRUALS_QUEUE, queue: accrualsQueue },
    ];
  }

  async check(): Promise<SystemHealth> {
    const mongodb = await this.checkMongodb();
    const { component: redis, queues } = await this.checkQueues();

    return {
      status: overallStatus([mongodb, redis]),
      components: [mongodb, redis],
      queues,
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

  /**
   * Queue depths, and with them the Redis check: BullMQ lives on Redis, so a failed
   * `getJobCounts` is the redis probe. The console tolerates a missing queues section,
   * which is why the failure degrades a component instead of failing the whole endpoint.
   */
  private async checkQueues(): Promise<{ component: ComponentHealth; queues: QueueHealth[] }> {
    try {
      const queues = await Promise.all(
        this.monitoredQueues.map(async ({ name, queue }) => {
          const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'completed');
          return {
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            failed: counts.failed ?? 0,
            completed: counts.completed ?? 0,
          };
        }),
      );
      return {
        component: { name: 'redis', status: 'healthy', latencyMs: null, detail: null },
        queues,
      };
    } catch (error) {
      return {
        component: { name: 'redis', status: 'degraded', latencyMs: null, detail: errorDetail(error) },
        queues: [],
      };
    }
  }
}
