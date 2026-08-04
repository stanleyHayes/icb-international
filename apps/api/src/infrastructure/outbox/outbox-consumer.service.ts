import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { HydratedDocument, Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { isDuplicateKeyError } from '../database/mongo-errors.js';
import { OutboxDeliveryDoc, type OutboxEventDoc } from './outbox.schemas.js';

/** The shape a consumer handler receives — a plain value, never a Mongoose document. */
export interface OutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  /** The request that caused the event; null for events published outside a request. */
  readonly correlationId: string | null;
}

export type OutboxEventHandler = (event: OutboxEvent) => Promise<void>;
export type DeliveryOutcome = 'delivered' | 'duplicate';

export function toOutboxEvent(doc: HydratedDocument<OutboxEventDoc>): OutboxEvent {
  return {
    id: doc._id,
    type: doc.type,
    payload: doc.payload,
    attempts: doc.attempts,
    correlationId: doc.correlationId ?? null,
  };
}

/**
 * Consumer registry and dedupe for outbox events.
 *
 * Consumers register a handler per event type at boot; several consumers may subscribe to the
 * same type (fan-out). Because the drain delivers at-least-once, every delivery is claimed in
 * `outbox_deliveries` first behind a unique (consumer, eventId) index — a redelivery loses the
 * claim and is skipped, which is what makes handling effectively-once. If a handler throws, the
 * claim is released so the retry is allowed to deliver again.
 */
@Injectable()
export class OutboxConsumerService {
  private readonly handlers = new Map<string, Map<string, OutboxEventHandler>>();

  constructor(
    @InjectModel(OutboxDeliveryDoc.name) private readonly deliveries: Model<OutboxDeliveryDoc>,
    private readonly clock: ClockService,
  ) {}

  register(type: string, consumer: string, handler: OutboxEventHandler): void {
    const forType = this.handlers.get(type) ?? new Map<string, OutboxEventHandler>();
    if (forType.has(consumer)) {
      throw new ConflictError(`Outbox consumer ${consumer} is already registered for ${type}`, {
        type,
        consumer,
      });
    }
    forType.set(consumer, handler);
    this.handlers.set(type, forType);
  }

  consumersFor(type: string): readonly string[] {
    return [...(this.handlers.get(type)?.keys() ?? [])];
  }

  /** Run one consumer's handler for one event, guarded by the dedupe claim. */
  async deliver(type: string, consumer: string, event: OutboxEvent): Promise<DeliveryOutcome> {
    const handler = this.handlers.get(type)?.get(consumer);
    if (handler === undefined) {
      throw new NotFoundError('Outbox consumer', `${type}/${consumer}`);
    }
    const claimed = await this.claimDelivery(consumer, event.id);
    if (!claimed) {
      return 'duplicate';
    }
    try {
      await handler(event);
      return 'delivered';
    } catch (error) {
      await this.deliveries.deleteOne({ consumer, eventId: event.id }).exec();
      throw error;
    }
  }

  private async claimDelivery(consumer: string, eventId: string): Promise<boolean> {
    try {
      await this.deliveries.create([
        { consumer, eventId, processedAt: this.clock.now() },
      ]);
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }
}
