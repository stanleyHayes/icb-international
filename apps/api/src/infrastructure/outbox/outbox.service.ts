import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError } from '../../common/errors/index.js';
import { currentCorrelationId } from '../../common/observability/correlation.context.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { OUTBOX_STATES, OutboxEventDoc } from './outbox.schemas.js';

export interface OutboxEventInput {
  readonly type: string;
  readonly payload: Record<string, unknown>;
  /** Defaults to now; pass a future instant to schedule a delayed event. */
  readonly availableAt?: Date;
  /** Defaults to the correlation id in scope; pass explicitly when there is none. */
  readonly correlationId?: string;
}

/**
 * Write half of the transactional outbox.
 *
 * `publish` must be called with the session of the transaction that is making the state change
 * the event describes. That is the entire point of the pattern: the domain write and the event
 * commit or roll back together, so an event can never announce a change that did not happen.
 */
@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(OutboxEventDoc.name) private readonly events: Model<OutboxEventDoc>,
    private readonly clock: ClockService,
  ) {}

  /** Insert the event inside the caller's transaction; returns the new event id. */
  async publish(event: OutboxEventInput, session: ClientSession): Promise<string> {
    const [created] = await this.events.create(
      [
        {
          type: event.type,
          payload: event.payload,
          // Stamped at write time, inside the same transaction as the state change: the
          // correlation thread survives the hand-off to the drain however long that takes.
          correlationId: event.correlationId ?? currentCorrelationId(),
          state: OUTBOX_STATES.Pending,
          attempts: 0,
          availableAt: event.availableAt ?? this.clock.now(),
          deliveredAt: null,
        },
      ],
      { session },
    );
    if (created === undefined) {
      throw new DomainError('INTERNAL_ERROR', 'Outbox insert returned no document');
    }
    return created._id;
  }
}
