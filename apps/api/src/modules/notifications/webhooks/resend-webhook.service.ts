import type { NotificationState } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ForbiddenError, ValidationError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { isForwardTransition } from '../domain/notification-state.js';
import {
  verifyWebhookSignature,
  type WebhookSignatureHeaders,
} from '../domain/resend-signature.js';
import { NotificationDoc } from '../infrastructure/notification.schemas.js';
import { STATE_BY_TYPE, describeFailure, resendEventSchema, type ResendEvent } from './resend-event.schema.js';

export interface WebhookDelivery {
  readonly payload: string;
  readonly headers: WebhookSignatureHeaders;
}

export interface WebhookOutcome {
  readonly received: boolean;
  readonly applied: boolean;
}

/**
 * Folds Resend's delivery events back into the notification record.
 *
 * Without this, "sent" is the last thing the bank ever knows about an email — which is not the
 * same as the customer receiving it. A bounce here is the difference between support saying "we
 * sent it" and support saying "it bounced, your mailbox is full, here is the address we used".
 */
@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(
    @InjectModel(NotificationDoc.name) private readonly notifications: Model<NotificationDoc>,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async receive(delivery: WebhookDelivery): Promise<WebhookOutcome> {
    this.assertSignature(delivery);

    const event = this.parse(delivery.payload);
    const state = STATE_BY_TYPE[event.type];

    if (state === undefined) {
      this.logger.debug({ type: event.type }, 'Resend event ignored — not a delivery outcome');
      return { received: true, applied: false };
    }

    return { received: true, applied: await this.fold(event, state) };
  }

  /**
   * An unsigned webhook is accepted only when no secret is configured, and says so in the log
   * every time. A configured secret that fails is a 403 — never a warning-and-continue, because
   * this endpoint can move a notification into `bounced` from anywhere on the internet.
   */
  private assertSignature(delivery: WebhookDelivery): void {
    const outcome = verifyWebhookSignature({
      payload: delivery.payload,
      headers: delivery.headers,
      secret: this.config.email.webhookSecret,
      nowMs: this.clock.epochMs(),
    });

    if (outcome === 'verified') {
      return;
    }
    if (outcome === 'unverified') {
      this.logger.warn(
        'RESEND_WEBHOOK_SECRET is empty — accepting this webhook with signature verification disabled',
      );
      return;
    }
    throw new ForbiddenError('The Resend webhook signature could not be verified', { outcome });
  }

  private parse(payload: string): ResendEvent {
    const result = resendEventSchema.safeParse(readJson(payload));
    if (!result.success) {
      throw new ValidationError('The webhook payload was not a recognised Resend event');
    }
    return result.data;
  }

  private async fold(event: ResendEvent, state: NotificationState): Promise<boolean> {
    const messageId = event.data.email_id;
    const record = await this.notifications.findOne({ providerMessageId: messageId }).lean();

    if (record === null) {
      // Mail this bank did not send, or a record already pruned. Never an error to the caller:
      // a 4xx makes Resend retry forever for something that will never resolve.
      this.logger.warn({ messageId, type: event.type }, 'No notification for this message id');
      return false;
    }

    if (!isForwardTransition(record.state, state)) {
      this.logger.debug({ messageId, from: record.state, to: state }, 'Out-of-order event ignored');
      return false;
    }

    await this.notifications.updateOne({ _id: record._id }, { $set: this.patchFor(event, state) });
    this.logger.log({ messageId, notificationId: record._id, state }, 'Delivery state updated');
    return true;
  }

  private patchFor(event: ResendEvent, state: NotificationState): Record<string, unknown> {
    const patch: Record<string, unknown> = { state };
    if (state === 'delivered') {
      patch['deliveredAt'] = this.clock.now();
    }
    const failure = describeFailure(event);
    if (failure !== null) {
      patch['failureReason'] = failure;
    }
    return patch;
  }
}

function readJson(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    throw new ValidationError('The webhook body was not valid JSON');
  }
}
