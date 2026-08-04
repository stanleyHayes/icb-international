import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { runWithCorrelation } from '../../../common/observability/correlation.context.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { OUTBOX_STATES, type OutboxEventDoc } from '../outbox.schemas.js';
import { OutboxService } from '../outbox.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const session = { id: 'txn-1' } as unknown as ClientSession;

function setup() {
  const model = { create: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new OutboxService(model as unknown as Model<OutboxEventDoc>, clock);
  return { model, service };
}

describe('publish', () => {
  it('inserts a pending event inside the caller transaction and returns its id', async () => {
    const { model, service } = setup();
    model.create.mockResolvedValue([{ _id: 'evt-1' }]);

    const id = await service.publish(
      { type: 'transfer.settled', payload: { transferId: 'trf-1' } },
      session,
    );

    expect(id).toBe('evt-1');
    expect(model.create).toHaveBeenCalledWith(
      [
        {
          type: 'transfer.settled',
          payload: { transferId: 'trf-1' },
          correlationId: null,
          state: OUTBOX_STATES.Pending,
          attempts: 0,
          availableAt: NOW,
          deliveredAt: null,
        },
      ],
      { session },
    );
  });

  it('stamps the event with the correlation id in scope at publish time', async () => {
    const { model, service } = setup();
    model.create.mockResolvedValue([{ _id: 'evt-3' }]);

    await runWithCorrelation('corr-req-9', () =>
      service.publish({ type: 'transfer.sent', payload: {} }, session),
    );

    const [rows] = model.create.mock.calls[0] as [{ correlationId: string | null }[]];
    expect(rows[0]?.correlationId).toBe('corr-req-9');
  });

  it('prefers an explicitly supplied correlation id over the ambient one', async () => {
    const { model, service } = setup();
    model.create.mockResolvedValue([{ _id: 'evt-4' }]);

    await runWithCorrelation('corr-ambient', () =>
      service.publish({ type: 'transfer.sent', payload: {}, correlationId: 'corr-explicit' }, session),
    );

    const [rows] = model.create.mock.calls[0] as [{ correlationId: string | null }[]];
    expect(rows[0]?.correlationId).toBe('corr-explicit');
  });

  it('honours a caller-supplied availability instant for delayed events', async () => {
    const { model, service } = setup();
    model.create.mockResolvedValue([{ _id: 'evt-2' }]);
    const later = new Date('2026-08-03T00:00:00.000Z');

    await service.publish({ type: 'statement.due', payload: {}, availableAt: later }, session);

    const [rows] = model.create.mock.calls[0] as [{ availableAt: Date }[]];
    expect(rows[0]?.availableAt).toBe(later);
  });

  it('throws a typed error when the insert yields no document', async () => {
    const { model, service } = setup();
    model.create.mockResolvedValue([]);

    await expect(
      service.publish({ type: 'x', payload: {} }, session),
    ).rejects.toThrow(DomainError);
  });
});
