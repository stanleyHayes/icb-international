/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AUDIT_OUTCOMES } from '../application/audit.port.js';
import type { SecurityEventDoc } from './auth.schemas.js';
import { MongoAuditStore } from './mongo-audit.store.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function setup(headHash: string | null) {
  const events = {
    findOne: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(headHash === null ? null : { hash: headHash }),
        }),
      }),
    }),
    create: vi.fn().mockResolvedValue([{}]),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const store = new MongoAuditStore(events as unknown as Model<SecurityEventDoc>, clock);
  return { events, store };
}

describe('MongoAuditStore.record', () => {
  it('appends a hash-chained event starting from the chain head', async () => {
    const { events, store } = setup('prev-hash');

    await store.record({
      actorId: 'usr-1',
      action: 'auth.login',
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: '10.0.0.1',
    });

    const [rows] = events.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      actorId: 'usr-1',
      action: 'auth.login',
      outcome: 'success',
      previousHash: 'prev-hash',
      occurredAt: NOW,
    });
    expect(typeof rows[0]?.['hash']).toBe('string');
  });

  it('opens the chain with a null previous hash', async () => {
    const { events, store } = setup(null);

    await store.record({ actorId: null, action: 'auth.login_failed', outcome: 'failure' });

    const [rows] = events.create.mock.calls[0] as [{ previousHash: string | null; hash: string }[]];
    expect(rows[0]?.previousHash).toBeNull();
    expect(rows[0]?.hash).toHaveLength(64);
  });

  it('defaults context and channel fields rather than storing undefined', async () => {
    const { events, store } = setup(null);

    await store.record({ actorId: 'usr-1', action: 'auth.logout', outcome: 'success' });

    const [rows] = events.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({ context: {}, ipAddress: null, userAgent: null });
  });

  it('swallows store failures — an audit hiccup must never break an auth flow', async () => {
    const { events, store } = setup(null);
    events.create.mockRejectedValue(new Error('mongo down'));

    await expect(
      store.record({ actorId: 'usr-1', action: 'auth.login', outcome: 'success' }),
    ).resolves.toBeUndefined();
  });
});
