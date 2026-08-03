import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DisputeDoc } from '../../risk/infrastructure/dispute.schemas.js';
import { WATCH_BATCH_LIMIT, WATCH_INTERVAL_MS } from '../disputes.constants.js';
import {
  detectChanges,
  type DisputeSnapshot,
  type WatchWatermark,
} from '../domain/dispute-watch.js';
import { DisputeWatchDoc } from '../infrastructure/dispute-watch.schemas.js';

/**
 * The dispute watcher — comms hook and SLA timer in one sweep.
 *
 * The dispute lifecycle itself is owned by the risk module and emits nothing, so this poll is
 * the bridge: it reads the append-only timeline, works out what changed since the last sweep,
 * and announces each change on the outbox. The announcement and the watermark that dedupes it
 * commit in one transaction, so a stage change is never told twice and never told never.
 *
 * SLA timing is derived, not scheduled: rather than arming one timer per dispute, every sweep
 * compares `slaDueAt` against the simulation clock. That keeps the deadline honest under time
 * travel — advance the clock a month and exactly the overdue disputes fire, once each.
 */
@Injectable()
export class DisputeWatchService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DisputeWatchService.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(CONFIG) private readonly appConfig: AppConfiguration,
    @InjectModel(DisputeDoc.name) private readonly disputes: Model<DisputeDoc>,
    @InjectModel(DisputeWatchDoc.name) private readonly watermarks: Model<DisputeWatchDoc>,
    private readonly outbox: OutboxService,
    private readonly transactions: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.appConfig.backgroundJobs.enabled) {
      return;
    }

    this.timer = setInterval(() => {
      void this.sweepOnce().catch((error: unknown) => {
        this.logger.error({ err: error }, 'Dispute watch sweep failed');
      });
    }, WATCH_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One sweep; returns how many disputes produced events. Overlapping sweeps are skipped. */
  async sweepOnce(): Promise<number> {
    if (this.sweeping) {
      return 0;
    }
    this.sweeping = true;
    try {
      return await this.sweep();
    } finally {
      this.sweeping = false;
    }
  }

  /** Most recently touched disputes first — a quiet dispute needs no attention. */
  private async sweep(): Promise<number> {
    const disputes = await this.disputes
      .find()
      .sort({ updatedAt: -1 })
      .limit(WATCH_BATCH_LIMIT)
      .lean();

    const watermarks = await this.loadWatermarks(disputes.map((dispute) => dispute._id));

    let announced = 0;
    for (const dispute of disputes) {
      const handled = await this.watchOne(toSnapshot(dispute), watermarks.get(dispute._id) ?? null);
      if (handled) {
        announced += 1;
      }
    }
    return announced;
  }

  private async loadWatermarks(disputeIds: readonly string[]): Promise<Map<string, WatchWatermark>> {
    const rows = await this.watermarks.find({ disputeId: { $in: disputeIds } }).lean();
    return new Map(
      rows.map((row) => [
        row.disputeId,
        { seenTimelineEntries: row.seenTimelineEntries, slaAlerted: row.slaAlertedAt !== null },
      ]),
    );
  }

  /** Announce one dispute's changes; a failure here must not stall the rest of the sweep. */
  private async watchOne(
    dispute: DisputeSnapshot,
    watermark: WatchWatermark | null,
  ): Promise<boolean> {
    const decision = detectChanges(dispute, watermark, this.clock.now());
    if (decision.events.length === 0) {
      return false;
    }

    try {
      await this.transactions.withTransaction((session) =>
        this.announce(dispute.id, decision.events, decision.next, session),
      );
      return true;
    } catch (error) {
      this.logger.error({ err: error, disputeId: dispute.id }, 'Could not announce dispute change');
      return false;
    }
  }

  private async announce(
    disputeId: string,
    events: readonly { type: string; payload: Record<string, unknown> }[],
    next: WatchWatermark,
    session: ClientSession,
  ): Promise<void> {
    for (const event of events) {
      await this.outbox.publish(event, session);
    }
    await this.watermarks
      .updateOne(
        { disputeId },
        {
          $set: {
            seenTimelineEntries: next.seenTimelineEntries,
            ...(next.slaAlerted ? { slaAlertedAt: this.clock.now() } : {}),
          },
        },
        { upsert: true, session },
      )
      .exec();
  }
}

function toSnapshot(doc: DisputeDoc): DisputeSnapshot {
  return {
    id: doc._id,
    reference: doc.reference,
    customerId: doc.customerId,
    stage: doc.stage,
    amountMinorUnits: doc.amountMinorUnits,
    currency: doc.currency,
    timeline: doc.timeline,
    slaDueAt: doc.slaDueAt,
    resolvedAt: doc.resolvedAt,
  };
}
