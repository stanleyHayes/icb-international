import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { APPROVED_POSTINGS_SWEEP_MS } from './manual-postings.constants.js';
import { ManualPostingsService } from './manual-postings.service.js';

/**
 * Turns approved manual postings into ledger transactions.
 *
 * Approving a posting only flips the approval's status; this sweep is what actually posts it.
 * It was a BullMQ repeatable job until Redis was removed — an in-process interval is the same
 * schedule without the broker, and correct here because the API runs as a single instance.
 *
 * Two properties carried over from the queue and worth keeping in mind:
 *
 *  - Idempotency lives in ManualPostingsService, on the claim on the tracking document. A sweep
 *    that overlaps or repeats a partial run skips what it already posted.
 *  - Failure is not terminal. There is no dead-letter queue to catch an exhausted job any more,
 *    but the sweep runs every APPROVED_POSTINGS_SWEEP_MS regardless of how the last one ended,
 *    so a transient Mongo failure is retried by the next pass rather than dropped. What is lost
 *    versus BullMQ is the durable record of repeated failure — hence the error log, which is now
 *    the only evidence a posting is stuck.
 */
@Injectable()
export class ManualPostingsSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ManualPostingsSweeper.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly manualPostings: ManualPostingsService,
  ) {}

  /**
   * Skipped when background jobs are disabled (CLI and seed runs) so a short-lived process never
   * schedules work it will not live to finish.
   */
  onApplicationBootstrap(): void {
    if (!this.config.backgroundJobs.enabled) {
      return;
    }
    this.timer = setInterval(() => {
      void this.sweepOnce();
    }, APPROVED_POSTINGS_SWEEP_MS);
    // Never hold the process open for a sweep; shutdown should not wait on the next tick.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * One pass. Overlapping passes are skipped rather than queued: a sweep that outruns the
   * interval would otherwise stack up behind a slow database and post the same batch twice.
   * Returns the number of postings executed, or null when the pass was skipped or failed.
   */
  async sweepOnce(): Promise<number | null> {
    if (this.sweeping) {
      return null;
    }
    this.sweeping = true;
    try {
      return await this.manualPostings.executeApproved();
    } catch (error) {
      this.logger.error(
        { err: error },
        'Approved-postings sweep failed; retrying on the next interval',
      );
      return null;
    } finally {
      this.sweeping = false;
    }
  }
}
