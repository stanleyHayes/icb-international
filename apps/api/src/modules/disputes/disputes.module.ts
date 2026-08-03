import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OutboxModule } from '../../infrastructure/outbox/outbox.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DisputeDoc, DisputeSchema } from '../risk/infrastructure/dispute.schemas.js';
import { DisputeCommsService } from './application/dispute-comms.service.js';
import { DisputeWatchService } from './application/dispute-watch.service.js';
import { DisputeWatchDoc, DisputeWatchSchema } from './infrastructure/dispute-watch.schemas.js';

/**
 * Disputes (agent_plan.md BE-24) — comms and SLA monitoring around the dispute lifecycle.
 *
 * The dispute aggregate itself (raise, stage machine, provisional credit, ledger postings) lives
 * in the risk module, which got there first; this module owns everything the lifecycle does not:
 * the customer is told at every stage via outbox events, and an SLA breach is announced the
 * sweep after the deadline passes rather than by an analyst noticing. It registers no routes, so
 * the `/disputes` surface stays single-homed.
 *
 * `DisputeDoc` is registered read-only — the watcher needs the timeline, never the write path;
 * all durable state of its own lives in `dispute_watch_states`.
 */
@Module({
  imports: [
    OutboxModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: DisputeDoc.name, schema: DisputeSchema },
      { name: DisputeWatchDoc.name, schema: DisputeWatchSchema },
    ]),
  ],
  providers: [DisputeWatchService, DisputeCommsService],
})
export class DisputesModule {}
