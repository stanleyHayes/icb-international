import type { NotificationChannel, NotificationEvent, NotificationState } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { ChannelDecision } from '../domain/channel-selector.js';
import { EMAIL_TRANSPORT, type EmailTransport } from '../domain/email-transport.js';
import type { NotificationPayload } from '../domain/notification-payload.js';
import { NotificationDoc } from '../infrastructure/notification.schemas.js';
import type { RenderedTemplate } from '../templates/template.types.js';

export interface DeliveryInput {
  readonly customerId: string;
  readonly event: NotificationEvent;
  readonly decision: ChannelDecision;
  readonly rendered: RenderedTemplate;
  readonly payload: NotificationPayload;
  readonly recipientEmail: string | null;
  readonly recipientPhone: string | null;
}

/** Everything a settled row records. Assembled per branch so no field is set to `undefined`. */
interface Settlement {
  readonly state: NotificationState;
  readonly recipient?: string;
  readonly providerName?: string;
  readonly providerMessageId?: string;
  readonly failureReason?: string;
  readonly sentAt?: Date;
  readonly deliveredAt?: Date;
  readonly attempts?: number;
}

const NO_EMAIL = 'No email address is on file for this customer';

/**
 * One channel, one row, one outcome.
 *
 * Every path through this service ends with a persisted state — including the paths where
 * nothing was sent. A notification that vanishes because a transport threw is the failure mode
 * that makes a support conversation unwinnable, so the row is written *before* the send and
 * settled after it.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectModel(NotificationDoc.name) private readonly notifications: Model<NotificationDoc>,
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    private readonly clock: ClockService,
  ) {}

  async deliver(input: DeliveryInput): Promise<NotificationDoc> {
    const queued = await this.queue(input);

    if (input.decision.suppressed) {
      return this.settle(queued._id, {
        state: 'suppressed',
        ...(input.decision.reason === null ? {} : { failureReason: input.decision.reason }),
      });
    }
    return this.dispatch(queued, input);
  }

  private async dispatch(queued: NotificationDoc, input: DeliveryInput): Promise<NotificationDoc> {
    switch (input.decision.channel) {
      case 'in_app':
        // The row *is* the delivery: writing it is the whole of the in-app channel.
        return this.settle(queued._id, { state: 'delivered', deliveredAt: this.clock.now() });
      case 'email':
        return this.sendEmail(queued, input);
      case 'sms':
        return this.simulate(queued, 'sms', input.recipientPhone);
      case 'push':
        return this.simulate(queued, 'push', input.customerId);
    }
  }

  private async sendEmail(queued: NotificationDoc, input: DeliveryInput): Promise<NotificationDoc> {
    const to = input.payload.recipientEmail ?? input.recipientEmail;
    if (to === null) {
      return this.settle(queued._id, { state: 'failed', failureReason: NO_EMAIL });
    }

    try {
      const result = await this.transport.send({
        to,
        subject: input.rendered.subject,
        html: input.rendered.html,
        text: input.rendered.text,
        tags: [
          { name: 'event', value: input.event },
          { name: 'notification_id', value: queued._id },
        ],
        // The row id is stable across retries, so the provider de-duplicates for us.
        idempotencyKey: queued._id,
      });

      return this.settle(queued._id, {
        state: 'sent',
        recipient: to,
        providerName: this.transport.name,
        providerMessageId: result.id,
        sentAt: this.clock.now(),
        attempts: queued.attempts + 1,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error({ notificationId: queued._id, reason }, 'Email delivery failed');
      return this.settle(queued._id, {
        state: 'failed',
        recipient: to,
        providerName: this.transport.name,
        failureReason: reason,
        attempts: queued.attempts + 1,
      });
    }
  }

  /**
   * SMS and push have no provider in this simulation. They are still recorded as real deliveries
   * with their own ids, so the preference matrix, quiet hours and the customer's delivery log
   * behave exactly as they would once a provider is wired in.
   */
  private async simulate(
    queued: NotificationDoc,
    channel: NotificationChannel,
    recipient: string | null,
  ): Promise<NotificationDoc> {
    const now = this.clock.now();
    return this.settle(queued._id, {
      state: 'delivered',
      ...(recipient === null ? {} : { recipient }),
      providerName: `simulated_${channel}`,
      providerMessageId: `sim_${newId()}`,
      sentAt: now,
      deliveredAt: now,
      attempts: queued.attempts + 1,
    });
  }

  private async queue(input: DeliveryInput): Promise<NotificationDoc> {
    const [created] = await this.notifications.create([
      {
        _id: newId(),
        customerId: input.customerId,
        event: input.event,
        channel: input.decision.channel,
        title: input.rendered.subject,
        // Only an inbox wants the full plain-text body; a bell, an SMS and a push notification
        // all want the one-line summary, and storing what was actually shown keeps the log honest.
        body: input.decision.channel === 'email' ? input.rendered.text : input.rendered.summary,
        state: 'queued',
        actionUrl: input.payload.actionUrl ?? null,
        payload: { ...input.payload },
        createdAt: this.clock.now(),
      },
    ], { ordered: true });

    if (created === undefined) {
      throw new ConflictError('The notification could not be recorded', {
        event: input.event,
        channel: input.decision.channel,
      });
    }
    return created;
  }

  private async settle(id: string, settlement: Settlement): Promise<NotificationDoc> {
    const updated = await this.notifications
      .findByIdAndUpdate(id, { $set: { ...settlement } }, { new: true })
      .lean();

    if (updated === null) {
      throw new NotFoundError('Notification', id);
    }
    return updated;
  }
}
