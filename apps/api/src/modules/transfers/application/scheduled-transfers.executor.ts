import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { isDomainError } from '../../../common/errors/index.js';
import { MetricsService } from '../../../common/observability/metrics.service.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { TRANSFER_EVENTS } from '../domain/transfers.constants.js';
import { executionPatch, failurePatch, timelineEntry } from '../infrastructure/transfer.factory.js';
import { TransferDoc } from '../infrastructure/transfer.schemas.js';
import { TransferOrchestrator } from './transfer-orchestrator.js';
import { TransferPreparationService } from './transfer-preparation.service.js';

/**
 * Runs a scheduled transfer when its instant arrives.
 *
 * The due event rides the outbox, so delivery is at-least-once; the conditional status claim
 * (`scheduled` → `processing`) is what makes a redelivery harmless. Funds are re-checked at
 * execution time — a balance that covered the transfer on Friday may not on Monday — and a
 * failed run is a failed transfer, never a silently dropped one.
 */
@Injectable()
export class ScheduledTransfersExecutor {
  private readonly logger = new Logger(ScheduledTransfersExecutor.name);

  // eslint-disable-next-line max-params -- every collaborator is load-bearing; a bag of unrelated infrastructure would satisfy the count and hurt the reading.
  constructor(
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly orchestrator: TransferOrchestrator,
    private readonly preparation: TransferPreparationService,
    private readonly transactionManager: TransactionManager,
    private readonly outbox: OutboxService,
    private readonly clock: ClockService,
    private readonly metrics: MetricsService,
  ) {}

  async executeDue(transferId: string): Promise<void> {
    const claimed = await this.claim(transferId);
    if (!claimed) {
      return;
    }
    try {
      // Prepared up front so the accounts it touches can be locked before the transaction opens.
      // The funds check then runs while holding those locks, which is stricter than it was:
      // two standing orders firing on one account at the same instant can no longer both pass it.
      const prepared = await this.preparation.preparedFromDocument(claimed);
      const lockKeys = await this.orchestrator.contendedKeys(prepared);

      const status = await this.transactionManager.withTransaction(async (session) => {
        await this.preparation.assertFunds(prepared);
        const execution = await this.orchestrator.executePrepared(prepared, session);

        await this.transfers.updateOne(
          { _id: transferId },
          executionPatch(execution, this.clock.now()),
          { session },
        );
        await this.orchestrator.publishSent(prepared, session);
        await this.planNextRun(claimed, session);
        return execution.status;
      }, { lockKeys });
      // After the commit, so a retried transaction never counts the same outcome twice.
      this.metrics.transferOutcome(claimed.rail, status);
      this.logger.log({ transferId }, 'Scheduled transfer executed');
    } catch (error) {
      await this.markFailed(claimed, error);
    }
  }

  /** Take the transfer first; a concurrent or repeated delivery finds it already moved on. */
  private async claim(transferId: string): Promise<TransferDoc | null> {
    return this.transfers.findOneAndUpdate(
      { _id: transferId, status: 'scheduled' },
      {
        $set: { status: 'processing' },
        $push: { timeline: timelineEntry(this.clock.now(), 'processing', null) },
      },
      { new: true },
    ).lean();
  }

  /** A standing-order run spawns the next occurrence; a one-off schedules nothing. */
  private async planNextRun(claimed: TransferDoc, session: ClientSession): Promise<void> {
    const next = await this.orchestrator.advanceSeries(claimed, session);
    if (next === null) {
      return;
    }
    await this.outbox.publish(
      {
        type: TRANSFER_EVENTS.due,
        payload: { transferId: next.transferId },
        availableAt: next.executeAt,
      },
      session,
    );
  }

  /** Failure is recorded with its own outbox event, in its own transaction. */
  private async markFailed(claimed: TransferDoc, error: unknown): Promise<void> {
    const code = isDomainError(error) ? error.code : 'INTERNAL_ERROR';
    const reason = error instanceof Error ? error.message : 'The transfer could not be completed';
    this.logger.warn({ transferId: claimed._id, code, reason }, 'Scheduled transfer failed');

    await this.transactionManager.withTransaction(async (session) => {
      await this.transfers.updateOne(
        { _id: claimed._id },
        failurePatch(this.clock.now(), code, reason),
        { session },
      );
      await this.outbox.publish(
        {
          type: TRANSFER_EVENTS.failed,
          payload: {
            customerId: claimed.customerId,
            transferId: claimed._id,
            reference: claimed.reference,
            code,
            reason,
          },
        },
        session,
      );
    });
    this.metrics.transferOutcome(claimed.rail, 'failed');
  }
}
