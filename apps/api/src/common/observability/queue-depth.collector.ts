import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { Queue } from 'bullmq';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { DEAD_LETTER_QUEUE } from '../../infrastructure/queue/queue.constants.js';
import { MetricsService } from './metrics.service.js';
import { QUEUE_DEPTH_STATES } from './metrics.registry.js';

/** How often depth is sampled. Scrape-interval granularity is enough; the data is a gauge. */
export const QUEUE_DEPTH_POLL_MS = 15_000;

/** @nestjs/bullmq registers every queue under this token prefix (see getQueueToken). */
const BULLMQ_QUEUE_TOKEN_PREFIX = 'BullQueue_';

/**
 * Samples BullMQ queue depths into gauges.
 *
 * Prometheus gauges must be fed — Prometheus only ever scrapes — so something has to ask Redis
 * how deep each queue is, and this is that something. Queues are discovered through Nest's
 * provider registry rather than a hand-maintained list, so a queue added by any module shows
 * up in the metrics without a second edit.
 *
 * A Redis outage must not take the process with it: a failed sample logs a warning and the
 * gauges keep their last values until the next pass succeeds.
 */
@Injectable()
export class QueueDepthCollector implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueDepthCollector.name);
  private timer: NodeJS.Timeout | null = null;
  private collecting = false;

  constructor(
    @Inject(CONFIG) private readonly appConfig: AppConfiguration,
    private readonly discovery: DiscoveryService,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.appConfig.backgroundJobs.enabled) {
      return;
    }

    this.timer = setInterval(() => {
      void this.collectOnce().catch((error: unknown) => {
        this.logger.warn({ err: error }, 'Queue depth sample failed');
      });
    }, QUEUE_DEPTH_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One sample across every registered queue. Overlapping passes are skipped. */
  async collectOnce(): Promise<number> {
    if (this.collecting) {
      return 0;
    }
    this.collecting = true;
    try {
      const queues = this.registeredQueues();
      for (const queue of queues) {
        await this.sample(queue);
      }
      return queues.length;
    } finally {
      this.collecting = false;
    }
  }

  /** Every provider the BullMQ module registered as a queue, with instances attached. */
  private registeredQueues(): Queue[] {
    return this.discovery
      .getProviders()
      .filter(
        (wrapper) =>
          typeof wrapper.token === 'string' && wrapper.token.startsWith(BULLMQ_QUEUE_TOKEN_PREFIX),
      )
      .map((wrapper) => wrapper.instance as Queue)
      .filter((instance) => typeof instance?.getJobCounts === 'function');
  }

  private async sample(queue: Queue): Promise<void> {
    try {
      const counts = await queue.getJobCounts(...QUEUE_DEPTH_STATES);
      for (const state of QUEUE_DEPTH_STATES) {
        this.metrics.queueDepth(queue.name, state, counts[state] ?? 0);
      }
      if (queue.name === DEAD_LETTER_QUEUE) {
        this.metrics.deadLetterQueueSize(counts.waiting ?? 0);
      }
    } catch (error) {
      // One unreachable queue (Redis down) forfeits its own sample, not the whole pass.
      this.logger.warn({ queue: queue.name, err: error }, 'Queue depth sample skipped');
    }
  }
}
