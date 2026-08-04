import { InjectQueue, Processor } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { DomainError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { BaseJobProcessor } from '../../infrastructure/queue/base.processor.js';
import { DEAD_LETTER_QUEUE } from '../../infrastructure/queue/queue.constants.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import {
  ADMIN_POSTING_JOB_NAMES,
  ADMIN_POSTINGS_QUEUE,
  APPROVED_POSTINGS_SCHEDULER_ID,
  APPROVED_POSTINGS_SWEEP_MS,
} from './manual-postings.constants.js';
import { ManualPostingsService } from './manual-postings.service.js';

/**
 * Worker for the admin postings queue.
 *
 * Approving a manual posting only flips the approval's status; this worker's repeatable
 * sweep is what turns approved requests into ledger transactions. Retries and the dead-letter
 * hand-off come from BaseJobProcessor; idempotency comes from the claim on the tracking
 * document underneath ManualPostingsService, so a retried sweep skips what it already posted.
 */
@Processor(ADMIN_POSTINGS_QUEUE)
@Injectable()
export class ManualPostingsProcessor
  extends BaseJobProcessor<Record<string, never>, number>
  implements OnModuleInit
{
  protected readonly logger = new Logger(ManualPostingsProcessor.name);

  constructor(
    @InjectQueue(ADMIN_POSTINGS_QUEUE) private readonly jobs: Queue,
    @InjectQueue(DEAD_LETTER_QUEUE) deadLetterQueue: Queue,
    clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly manualPostings: ManualPostingsService,
  ) {
    super(deadLetterQueue, clock);
  }

  /**
   * Register the repeatable sweep. bullmq 6's upsertJobScheduler takes a fixed scheduler id,
   * so every boot re-registers the same schedule instead of accumulating duplicates.
   * Skipped when background jobs are disabled (CLI runs) so a short-lived process never
   * schedules work it will not live to run.
   */
  async onModuleInit(): Promise<void> {
    if (!this.config.backgroundJobs.enabled) {
      return;
    }
    await this.jobs.upsertJobScheduler(
      APPROVED_POSTINGS_SCHEDULER_ID,
      { every: APPROVED_POSTINGS_SWEEP_MS },
      { name: ADMIN_POSTING_JOB_NAMES.sweepApproved, data: {} },
    );
  }

  protected handle(job: Job<Record<string, never>, number>): Promise<number> {
    if (job.name !== ADMIN_POSTING_JOB_NAMES.sweepApproved) {
      throw new DomainError('INTERNAL_ERROR', `Unknown admin postings job: ${job.name}`, {
        context: { jobName: job.name, jobId: job.id ?? null },
      });
    }
    return this.manualPostings.executeApproved();
  }
}
