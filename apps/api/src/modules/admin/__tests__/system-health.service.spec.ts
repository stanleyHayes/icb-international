import type { Queue } from 'bullmq';
import type { Connection } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { SystemHealthService } from '../system-health.service.js';

const START = new Date('2026-08-03T12:00:00.000Z');
const MONGODB = 'mongodb';
const REDIS = 'redis';

const COUNTS = { waiting: 3, active: 1, failed: 2, completed: 42 };

function makeHarness(options: { readyState?: number } = {}) {
  const ping = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: 1 });
  const connection = {
    readyState: options.readyState ?? 1,
    db: { admin: () => ({ ping }) },
  } as unknown as Connection;
  const deadLetterCounts = vi.fn().mockResolvedValue({ ...COUNTS });
  const accrualsCounts = vi.fn().mockResolvedValue({ ...COUNTS });
  const deadLetter = { getJobCounts: deadLetterCounts } as unknown as Queue;
  const accruals = { getJobCounts: accrualsCounts } as unknown as Queue;
  const clock = new ClockService();
  clock.freeze(START);
  const service = new SystemHealthService(connection, deadLetter, accruals, clock);
  return { service, ping, deadLetterCounts };
}

describe('SystemHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports healthy with component latencies and queue counts', async () => {
    const { service } = makeHarness();

    const health = await service.check();

    expect(health.status).toBe('healthy');
    expect(health.components).toEqual([
      { name: MONGODB, status: 'healthy', latencyMs: 0, detail: null },
      { name: REDIS, status: 'healthy', latencyMs: null, detail: null },
    ]);
    expect(health.queues).toEqual([
      { name: 'dead-letter', ...COUNTS },
      { name: 'accruals', ...COUNTS },
    ]);
    expect(health.uptimeSeconds).toBe(0);
    expect(health.version).toBeTruthy();
    expect(health.checkedAt).toBe(START.toISOString());
  });

  it('reports down when the mongodb ping fails, with the failure as detail', async () => {
    const { service, ping } = makeHarness();
    ping.mockRejectedValue(new Error('connection reset'));

    const health = await service.check();

    expect(health.status).toBe('down');
    const mongodb = health.components.find((component) => component.name === MONGODB);
    expect(mongodb?.status).toBe('down');
    expect(mongodb?.detail).toBe('connection reset');
    expect(mongodb?.latencyMs).toBeNull();
  });

  it('reports down when mongoose is not connected, without pinging', async () => {
    const { service, ping } = makeHarness({ readyState: 0 });

    const health = await service.check();

    expect(health.status).toBe('down');
    expect(ping).not.toHaveBeenCalled();
  });

  it('degrades and empties the queues section when redis fails', async () => {
    const { service, deadLetterCounts } = makeHarness();
    deadLetterCounts.mockRejectedValue(new Error('redis unreachable'));

    const health = await service.check();

    expect(health.status).toBe('degraded');
    expect(health.queues).toEqual([]);
    const redis = health.components.find((component) => component.name === REDIS);
    expect(redis?.status).toBe('degraded');
    expect(redis?.detail).toBe('redis unreachable');
    const mongodb = health.components.find((component) => component.name === MONGODB);
    expect(mongodb?.status).toBe('healthy');
  });
});
