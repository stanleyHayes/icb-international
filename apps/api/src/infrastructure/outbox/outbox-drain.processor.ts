import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import {
  OUTBOX_BASE_BACKOFF_MS,
  OUTBOX_BATCH_LIMIT,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_MAX_BACKOFF_MS,
  OUTBOX_POLL_INTERVAL_MS,
} from './outbox.constants.js';
import { OutboxConsumerService, toOutboxEvent } from './outbox-consumer.service.js';
import {
  OUTBOX_STATES,
  OutboxEventDoc,
  type OutboxEventDocument,
} from './outbox.schemas.js';

/**
 * Read half of the transactional outbox.
 *
 * Polls `outbox_events` and dispatches each due event to its registered consumers. Delivery is
 * at-least-once by construction: the event row is only marked `delivered` after every consumer
 * has handled it, so a crash anywhere before that update replays the event — the consumer-side
 * dedupe claim (OutboxConsumerService) is what absorbs the replay.
 *
 * Events are claimed with an atomic `findOneAndUpdate` into `publishing`, so several API
 * replicas can drain the same collection without handing one event to two drains. A failed
 * dispatch reschedules with exponential backoff and gives up into `failed` after
 * OUTBOX_MAX_ATTEMPTS, where operations tooling can inspect and replay it.
 */
@Injectable()
export class OutboxDrainProcessor implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDrainProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  constructor(
    @InjectModel(OutboxEventDoc.name) private readonly events: Model<OutboxEventDoc>,
    private readonly consumers: OutboxConsumerService,
    private readonly clock: ClockService,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.drainOnce().catch((error: unknown) => {
        this.logger.error({ err: error }, 'Outbox drain pass failed');
      });
    }, OUTBOX_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One drain pass; returns the number of events claimed. Overlapping passes are skipped. */
  async drainOnce(): Promise<number> {
    if (this.draining) {
      return 0;
    }
    this.draining = true;
    try {
      return await this.drainBatch();
    } finally {
      this.draining = false;
    }
  }

  private async drainBatch(): Promise<number> {
    let drained = 0;
    while (drained < OUTBOX_BATCH_LIMIT) {
      const event = await this.claimNext();
      if (event === null) {
        break;
      }
      await this.dispatch(event);
      drained += 1;
    }
    return drained;
  }

  private async claimNext(): Promise<OutboxEventDocument | null> {
    return this.events
      .findOneAndUpdate(
        { state: OUTBOX_STATES.Pending, availableAt: { $lte: this.clock.now() } },
        { $set: { state: OUTBOX_STATES.Publishing }, $inc: { attempts: 1 } },
        { new: true, sort: { availableAt: 1, _id: 1 } },
      )
      .exec();
  }

  private async dispatch(event: OutboxEventDocument): Promise<void> {
    try {
      await this.deliverToAll(event);
      await this.events
        .updateOne(
          { _id: event._id },
          { $set: { state: OUTBOX_STATES.Delivered, deliveredAt: this.clock.now() } },
        )
        .exec();
    } catch (error) {
      await this.reschedule(event, error);
    }
  }

  private async deliverToAll(event: OutboxEventDocument): Promise<void> {
    const consumers = this.consumers.consumersFor(event.type);
    if (consumers.length === 0) {
      throw new DomainError('INTERNAL_ERROR', `No outbox consumer registered for ${event.type}`, {
        context: { type: event.type, eventId: event._id },
      });
    }
    for (const consumer of consumers) {
      await this.consumers.deliver(event.type, consumer, toOutboxEvent(event));
    }
  }

  private async reschedule(event: OutboxEventDocument, error: unknown): Promise<void> {
    const exhausted = event.attempts >= OUTBOX_MAX_ATTEMPTS;
    const state = exhausted ? OUTBOX_STATES.Failed : OUTBOX_STATES.Pending;
    const backoffMs = Math.min(
      OUTBOX_BASE_BACKOFF_MS * 2 ** (event.attempts - 1),
      OUTBOX_MAX_BACKOFF_MS,
    );
    this.logger.warn(
      { eventId: event._id, type: event.type, attempts: event.attempts, exhausted, err: error },
      'Outbox delivery failed',
    );
    await this.events
      .updateOne(
        { _id: event._id },
        { $set: { state, availableAt: new Date(this.clock.epochMs() + backoffMs) } },
      )
      .exec();
  }
}
