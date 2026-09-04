import type { FastifyReply } from 'fastify';
import type { Connection } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../config/configuration.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { HealthController } from './health.controller.js';
import type { LedgerHealthService } from './ledger-health.service.js';

const FROZEN = new Date('2026-08-02T12:00:00.000Z');

/** Mongoose `readyState`: 1 is connected, 0 disconnected. */
function setup(readyState: number) {
  const clock = new ClockService();
  clock.freeze(FROZEN);
  const controller = new HealthController(
    { readyState } as unknown as Connection,
    { bank: { name: 'ICB' } } as AppConfiguration,
    clock,
    {} as LedgerHealthService,
  );
  const status = vi.fn();
  return { controller, status, reply: { status } as unknown as FastifyReply };
}

describe('HealthController readiness', () => {
  it('answers 200 while the database is connected', () => {
    const { controller, status, reply } = setup(1);

    const body = controller.ready(reply);

    expect(status).toHaveBeenCalledWith(200);
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });

  it('answers 503 when the database is gone, so a probe stops routing traffic here', () => {
    // The regression this guards: the body said `not_ready` while the status line said 200, so
    // Render's `healthCheckPath` and the compose health check both kept an instance in
    // rotation whose every request was failing.
    const { controller, status, reply } = setup(0);

    const body = controller.ready(reply);

    expect(status).toHaveBeenCalledWith(503);
    expect(body.status).toBe('not_ready');
    expect(body.database).toBe('disconnected');
  });

  it('still reports the bank clock on both paths', () => {
    const { controller, reply } = setup(0);

    const body = controller.ready(reply);

    expect(body.serverTime).toBe(FROZEN.toISOString());
    expect(body.businessDate).toBe('2026-08-02');
  });
});
