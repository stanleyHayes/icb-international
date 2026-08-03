import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import {
  OutboxConsumerService,
  type OutboxEvent,
} from '../../../infrastructure/outbox/outbox-consumer.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { DISPUTE_COMMS_CONSUMER, DISPUTE_EVENT_TYPES } from '../disputes.constants.js';
import {
  slaBreachedPayloadSchema,
  stageChangedPayloadSchema,
} from '../domain/dispute-watch.js';

const SLA_BREACH_DETAIL =
  'Your dispute is taking longer than the deadline we set ourselves. It stays open, and we will keep pursuing it — you do not need to do anything.';

/**
 * The customer-comms half of the disputes module.
 *
 * Subscribes to the dispute events on the outbox and turns each one into a notification through
 * the notifications module's single front door. The watcher decides *that* something worth
 * saying happened; this service only decides how to say it, so the wording of customer comms
 * never entangles itself with collection scanning.
 */
@Injectable()
export class DisputeCommsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DisputeCommsService.name);

  constructor(
    @Inject(CONFIG) private readonly appConfig: AppConfiguration,
    private readonly consumers: OutboxConsumerService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.appConfig.backgroundJobs.enabled) {
      return;
    }

    this.consumers.register(DISPUTE_EVENT_TYPES.StageChanged, DISPUTE_COMMS_CONSUMER, (event) =>
      this.onStageChanged(event),
    );
    this.consumers.register(DISPUTE_EVENT_TYPES.SlaBreached, DISPUTE_COMMS_CONSUMER, (event) =>
      this.onSlaBreached(event),
    );
  }

  private async onStageChanged(event: OutboxEvent): Promise<void> {
    const payload = stageChangedPayloadSchema.parse(event.payload);
    await this.notifications.notify('dispute_update', payload.customerId, {
      reference: payload.reference,
      status: payload.stage,
      detail: payload.note,
      ...(payload.amount === undefined ? {} : { amount: payload.amount }),
    });
    this.logger.debug(
      { disputeId: payload.disputeId, stage: payload.stage },
      'Customer told of dispute stage change',
    );
  }

  private async onSlaBreached(event: OutboxEvent): Promise<void> {
    const payload = slaBreachedPayloadSchema.parse(event.payload);
    await this.notifications.notify('dispute_update', payload.customerId, {
      reference: payload.reference,
      status: payload.stage,
      detail: SLA_BREACH_DETAIL,
      ...(payload.amount === undefined ? {} : { amount: payload.amount }),
    });
    this.logger.log(
      { disputeId: payload.disputeId, slaDueAt: payload.slaDueAt },
      'Customer told their dispute has passed its deadline',
    );
  }
}
