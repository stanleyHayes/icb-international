import type { Connection } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { SystemHealthService } from '../system-health.service.js';

const START = new Date('2026-08-03T12:00:00.000Z');
const MONGODB = 'mongodb';

function makeHarness(options: { readyState?: number } = {}) {
  const ping = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: 1 });
  const connection = {
    readyState: options.readyState ?? 1,
    db: { admin: () => ({ ping }) },
  } as unknown as Connection;
  const clock = new ClockService();
  clock.freeze(START);
  const service = new SystemHealthService(connection, clock);
  return { service, ping };
}

describe('SystemHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports healthy with mongodb as the only component', async () => {
    const { service } = makeHarness();

    const health = await service.check();

    expect(health.status).toBe('healthy');
    expect(health.components).toEqual([
      { name: MONGODB, status: 'healthy', latencyMs: 0, detail: null },
    ]);
    // The queues section survives as an empty array: the console reads it, and the contract
    // still declares it, but there are no queues left to report on.
    expect(health.queues).toEqual([]);
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
});
