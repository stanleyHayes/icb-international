import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { currentCorrelationId } from '../../../common/observability/correlation.context.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { OutboxConsumerService } from '../outbox-consumer.service.js';
import { OutboxDrainProcessor } from '../outbox-drain.processor.js';
import {
  OUTBOX_BASE_BACKOFF_MS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_MAX_BACKOFF_MS,
} from '../outbox.constants.js';
import { OUTBOX_STATES, type OutboxEventDoc, type OutboxEventDocument } from '../outbox.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function queryOf<T>(result: T) {
  return { exec: vi.fn().mockResolvedValue(result) };
}

function fakeEvent(overrides: Partial<OutboxEventDoc> = {}): OutboxEventDocument {
  return {
    _id: 'evt-1',
    type: 'transfer.settled',
    payload: { transferId: 'trf-1' },
    state: OUTBOX_STATES.Pending,
    attempts: 1,
    availableAt: NOW,
    deliveredAt: null,
    ...overrides,
  } as OutboxEventDocument;
}

function setup() {
  const events = {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn().mockReturnValue(queryOf({})),
  };
  const consumers = {
    consumersFor: vi.fn().mockReturnValue(['emailer']),
    deliver: vi.fn().mockResolvedValue('delivered'),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const processor = new OutboxDrainProcessor(
{ backgroundJobs: { enabled: true } } as AppConfiguration,
events as unknown as Model<OutboxEventDoc>,
    consumers as unknown as OutboxConsumerService,
    clock,
  );
  return { events, consumers, processor };
}

function claimSequence(events: { findOneAndUpdate: ReturnType<typeof vi.fn> }, docs: (OutboxEventDocument | null)[]) {
  for (const doc of docs) {
    events.findOneAndUpdate.mockReturnValueOnce(queryOf(doc));
  }
  events.findOneAndUpdate.mockReturnValue(queryOf(null));
}

describe('drainOnce', () => {
  it('claims due pending events atomically, in availability order', async () => {
    const { events, processor } = setup();
    claimSequence(events, [fakeEvent()]);

    await processor.drainOnce();

    expect(events.findOneAndUpdate).toHaveBeenCalledWith(
      { state: OUTBOX_STATES.Pending, availableAt: { $lte: NOW } },
      { $set: { state: OUTBOX_STATES.Publishing }, $inc: { attempts: 1 } },
      { new: true, sort: { availableAt: 1, _id: 1 } },
    );
  });

  it('delivers to every registered consumer and marks the event delivered', async () => {
    const { events, consumers, processor } = setup();
    claimSequence(events, [fakeEvent()]);

    await expect(processor.drainOnce()).resolves.toBe(1);

    expect(consumers.deliver).toHaveBeenCalledWith('transfer.settled', 'emailer', {
      id: 'evt-1',
      type: 'transfer.settled',
      payload: { transferId: 'trf-1' },
      attempts: 1,
      correlationId: null,
    });
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      { $set: { state: OUTBOX_STATES.Delivered, deliveredAt: NOW } },
    );
  });

  it('drains a batch of events in one pass', async () => {
    const { events, processor } = setup();
    claimSequence(events, [fakeEvent(), fakeEvent({ _id: 'evt-2' })]);

    await expect(processor.drainOnce()).resolves.toBe(2);
  });

  it('delivers under the correlation id stamped on the event, ending the scope afterwards', async () => {
    const { events, consumers, processor } = setup();
    let seenDuringDelivery: string | null = null;
    consumers.deliver.mockImplementation(() => {
      seenDuringDelivery = currentCorrelationId();
      return Promise.resolve('delivered');
    });
    claimSequence(events, [fakeEvent({ correlationId: 'corr-req-5' })]);

    await processor.drainOnce();

    expect(seenDuringDelivery).toBe('corr-req-5');
    expect(currentCorrelationId()).toBeNull();
  });

  it('gives an event published outside a request a fresh correlation scope', async () => {
    const { events, consumers, processor } = setup();
    let seenDuringDelivery: string | null = null;
    consumers.deliver.mockImplementation(() => {
      seenDuringDelivery = currentCorrelationId();
      return Promise.resolve('delivered');
    });
    claimSequence(events, [fakeEvent({ correlationId: null })]);

    await processor.drainOnce();

    expect(seenDuringDelivery).toEqual(expect.any(String));
  });

  it('reschedules with exponential backoff when delivery fails', async () => {
    const { events, consumers, processor } = setup();
    consumers.deliver.mockRejectedValue(new Error('smtp down'));
    claimSequence(events, [fakeEvent({ attempts: 3 })]);

    await processor.drainOnce();

    const backoffMs = OUTBOX_BASE_BACKOFF_MS * 2 ** 2;
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      {
        $set: {
          state: OUTBOX_STATES.Pending,
          availableAt: new Date(NOW.getTime() + backoffMs),
        },
      },
    );
  });

  it('marks the event failed, with capped backoff, once attempts are exhausted', async () => {
    const { events, consumers, processor } = setup();
    consumers.deliver.mockRejectedValue(new Error('smtp down'));
    claimSequence(events, [fakeEvent({ attempts: OUTBOX_MAX_ATTEMPTS })]);

    await processor.drainOnce();

    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      {
        $set: {
          state: OUTBOX_STATES.Failed,
          availableAt: new Date(NOW.getTime() + OUTBOX_MAX_BACKOFF_MS),
        },
      },
    );
  });

  it('reschedules an event that has no registered consumer instead of dropping it', async () => {
    const { events, consumers, processor } = setup();
    consumers.consumersFor.mockReturnValue([]);
    claimSequence(events, [fakeEvent()]);

    await processor.drainOnce();

    expect(consumers.deliver).not.toHaveBeenCalled();
    expect(events.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1' },
      expect.objectContaining({ $set: expect.objectContaining({ state: OUTBOX_STATES.Pending }) as unknown }),
    );
  });

  it('refuses to run a second overlapping pass', async () => {
    const { events, processor } = setup();
    let release!: (value: null) => void;
    const pending = new Promise<null>((resolve) => {
      release = resolve;
    });
    events.findOneAndUpdate.mockReturnValue({ exec: () => pending });

    const first = processor.drainOnce();
    await expect(processor.drainOnce()).resolves.toBe(0);

    release(null);
    await expect(first).resolves.toBe(0);
  });
});

describe('lifecycle', () => {
  it('starts the poll timer on bootstrap and clears it on destroy', () => {
    vi.useFakeTimers();
    try {
      const { processor } = setup();

      processor.onApplicationBootstrap();
      expect(vi.getTimerCount()).toBe(1);

      processor.onModuleDestroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
