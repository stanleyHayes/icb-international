import type { DiscoveryService } from '@nestjs/core';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { DEAD_LETTER_QUEUE } from '../../../infrastructure/queue/queue.constants.js';
import { MetricsService } from '../metrics.service.js';
import { QueueDepthCollector } from '../queue-depth.collector.js';

function queueStub(name: string, counts: Record<string, number>): Queue {
  return { name, getJobCounts: vi.fn().mockResolvedValue(counts) } as unknown as Queue;
}

/** Discovery returns wrappers the way Nest builds them: token plus instance. */
function discoveryOf(queues: Queue[]): DiscoveryService {
  return {
    getProviders: () => [
      ...queues.map((instance) => ({ token: `BullQueue_${instance.name}`, instance })),
      // Non-queue providers must be ignored, including not-yet-instantiated ones.
      { token: 'SomeService', instance: {} },
      { token: 'BullQueue_ghost', instance: undefined },
    ],
  } as unknown as DiscoveryService;
}

function configWith(backgroundJobs: boolean): AppConfiguration {
  return { backgroundJobs: { enabled: backgroundJobs } } as AppConfiguration;
}

function setup(queues: Queue[], backgroundJobs = true) {
  const metrics = new MetricsService();
  const collector = new QueueDepthCollector(
    configWith(backgroundJobs),
    discoveryOf(queues),
    metrics,
  );
  return { collector, metrics };
}

describe('QueueDepthCollector', () => {
  it('samples every discovered queue into depth gauges', async () => {
    const { collector, metrics } = setup([
      queueStub('accruals', { waiting: 3, active: 1, delayed: 0, failed: 2 }),
    ]);

    const sampled = await collector.collectOnce();

    expect(sampled).toBe(1);
    const text = await metrics.render();
    expect(text).toContain('icb_queue_depth{queue="accruals",state="waiting"} 3');
    expect(text).toContain('icb_queue_depth{queue="accruals",state="failed"} 2');
  });

  it('feeds the DLQ size gauge from the dead-letter queue', async () => {
    const { collector, metrics } = setup([
      queueStub(DEAD_LETTER_QUEUE, { waiting: 5, active: 0, delayed: 0, failed: 0 }),
    ]);

    await collector.collectOnce();

    expect(await metrics.render()).toContain('icb_dlq_size 5');
  });

  it('a queue that cannot be reached forfeits its sample, not the whole pass', async () => {
    const broken = {
      name: 'unreachable',
      getJobCounts: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as Queue;
    const healthy = queueStub('accruals', { waiting: 1, active: 0, delayed: 0, failed: 0 });
    const { collector, metrics } = setup([broken, healthy]);

    const sampled = await collector.collectOnce();

    expect(sampled).toBe(2);
    expect(await metrics.render()).toContain('icb_queue_depth{queue="accruals",state="waiting"} 1');
  });

  it('does not start polling when background jobs are disabled', () => {
    vi.useFakeTimers();
    try {
      const { collector } = setup([queueStub('accruals', { waiting: 9 })], false);
      collector.onApplicationBootstrap();
      expect(vi.getTimerCount()).toBe(0);
      collector.onModuleDestroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts an unrefed polling timer when background jobs are enabled', () => {
    vi.useFakeTimers();
    try {
      const { collector } = setup([]);
      collector.onApplicationBootstrap();
      expect(vi.getTimerCount()).toBe(1);
      collector.onModuleDestroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
