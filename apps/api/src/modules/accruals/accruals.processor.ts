import { InjectQueue, Processor } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { BaseJobProcessor } from '../../infrastructure/queue/base.processor.js';
import { DEAD_LETTER_QUEUE } from '../../infrastructure/queue/queue.constants.js';
import { DomainError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { ACCRUAL_JOB_NAMES, ACCRUALS_QUEUE } from './accruals.constants.js';
import { AccrualsService, type AccrualRunReport } from './accruals.service.js';

export interface DailyRunJobData {
  readonly businessDate?: string;
}

/**
 * Worker for the accruals queue.
 *
 * The queue exists so the daily close can be scheduled (by an operator, a scenario, or the
 * simulation clock) without the caller waiting on a full portfolio pass. Retries and the
 * dead-letter hand-off come from BaseJobProcessor; idempotency comes from the claim indexes
 * underneath AccrualsService, so a retried job after a partial run completes the day rather
 * than duplicating it.
 */
@Processor(ACCRUALS_QUEUE)
@Injectable()
export class AccrualsProcessor extends BaseJobProcessor<DailyRunJobData, AccrualRunReport> {
  protected readonly logger = new Logger(AccrualsProcessor.name);

  constructor(
    @InjectQueue(DEAD_LETTER_QUEUE) deadLetterQueue: Queue,
    clock: ClockService,
    private readonly accruals: AccrualsService,
  ) {
    super(deadLetterQueue, clock);
  }

  protected handle(job: Job<DailyRunJobData, AccrualRunReport>): Promise<AccrualRunReport> {
    if (job.name !== ACCRUAL_JOB_NAMES.dailyRun) {
      throw new DomainError('INTERNAL_ERROR', `Unknown accruals job: ${job.name}`, {
        context: { jobName: job.name, jobId: job.id ?? null },
      });
    }
    return this.accruals.runDaily(job.data.businessDate);
  }
}
