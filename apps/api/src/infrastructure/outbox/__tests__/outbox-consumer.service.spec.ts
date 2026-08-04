import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DUPLICATE_KEY_CODE } from '../../database/database.constants.js';
import {
  OutboxConsumerService,
  type OutboxEvent,
} from '../outbox-consumer.service.js';
import type { OutboxDeliveryDoc } from '../outbox.schemas.js';

const event: OutboxEvent = {
  id: 'evt-1',
  type: 'transfer.settled',
  payload: { transferId: 'trf-1' },
  attempts: 1,
  correlationId: 'corr-1',
};

function setup() {
  const deliveries = {
    create: vi.fn().mockResolvedValue([{ _id: 'del-1' }]),
    deleteOne: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue({}) }),
  };
  const clock = new ClockService();
  clock.freeze(new Date('2026-08-02T12:00:00.000Z'));
  const service = new OutboxConsumerService(
    deliveries as unknown as Model<OutboxDeliveryDoc>,
    clock,
  );
  return { deliveries, service };
}

describe('register', () => {
  it('rejects a second registration of the same consumer for the same type', () => {
    const { service } = setup();
    service.register('transfer.settled', 'emailer', vi.fn());

    expect(() => service.register('transfer.settled', 'emailer', vi.fn())).toThrow(ConflictError);
  });

  it('fans out: different consumers may subscribe to the same type', () => {
    const { service } = setup();
    service.register('transfer.settled', 'emailer', vi.fn());
    service.register('transfer.settled', 'analytics', vi.fn());

    expect(service.consumersFor('transfer.settled')).toStrictEqual(['emailer', 'analytics']);
    expect(service.consumersFor('unknown.type')).toStrictEqual([]);
  });
});

describe('deliver', () => {
  it('claims the delivery, runs the handler, and reports delivered', async () => {
    const { deliveries, service } = setup();
    const handler = vi.fn().mockResolvedValue(undefined);
    service.register(event.type, 'emailer', handler);

    await expect(service.deliver(event.type, 'emailer', event)).resolves.toBe('delivered');
    expect(deliveries.create).toHaveBeenCalledWith([
      { consumer: 'emailer', eventId: event.id, processedAt: expect.any(Date) as Date },
    ]);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('skips a redelivery that loses the dedupe claim', async () => {
    const { deliveries, service } = setup();
    const handler = vi.fn();
    service.register(event.type, 'emailer', handler);
    deliveries.create.mockRejectedValue({ code: DUPLICATE_KEY_CODE });

    await expect(service.deliver(event.type, 'emailer', event)).resolves.toBe('duplicate');
    expect(handler).not.toHaveBeenCalled();
  });

  it('releases the claim when the handler fails so the retry can deliver again', async () => {
    const { deliveries, service } = setup();
    const failure = new Error('smtp down');
    service.register(event.type, 'emailer', vi.fn().mockRejectedValue(failure));

    await expect(service.deliver(event.type, 'emailer', event)).rejects.toBe(failure);
    expect(deliveries.deleteOne).toHaveBeenCalledWith({
      consumer: 'emailer',
      eventId: event.id,
    });
  });

  it('rethrows a claim failure that is not a duplicate key', async () => {
    const { deliveries, service } = setup();
    service.register(event.type, 'emailer', vi.fn());
    const outage = new Error('mongo unreachable');
    deliveries.create.mockRejectedValue(outage);

    await expect(service.deliver(event.type, 'emailer', event)).rejects.toBe(outage);
  });

  it('throws NotFoundError for an unregistered consumer', async () => {
    const { service } = setup();

    await expect(service.deliver(event.type, 'ghost', event)).rejects.toThrow(NotFoundError);
  });
});
