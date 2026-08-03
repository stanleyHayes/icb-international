import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { ValidationError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import {
  ACCRUAL_JOB_NAMES,
  ACCRUALS_QUEUE,
  ISO_DATE_PATTERN,
  dailyRunJobId,
} from './accruals.constants.js';
import { CapitalisationService, type CapitalisationSummary } from './capitalisation.service.js';
import { FeeAssessmentService, type FeeAssessmentSummary } from './fee-assessment.service.js';
import { InterestAccrualService, type AccrualRunSummary } from './interest-accrual.service.js';
import { OverdraftFeeService, type OverdraftFeeSummary } from './overdraft-fee.service.js';

/** What one daily run produced, per stage. */
export interface AccrualRunReport {
  readonly businessDate: string;
  readonly accrual: AccrualRunSummary;
  readonly capitalisation: CapitalisationSummary;
  readonly overdraft: OverdraftFeeSummary;
  readonly fees: FeeAssessmentSummary;
}

/**
 * The interest & fees engine's front door — and the manual trigger the end-of-day pipeline
 * drives (SIM-05 integration point).
 *
 * `runDaily` closes one business date, in the order the books require: measure interest
 * first, capitalise what is due second (so a fee never reverses an accrual on the same day),
 * then assess overdraft and periodic fees. Every stage is idempotent against its own claim
 * index, so the whole run is safe to replay — a property the EOD batch relies on when an
 * operator re-runs a date.
 *
 * `enqueueDailyRun` puts the same run on the accruals queue with a deterministic job id, so
 * enqueueing a date twice is a no-op.
 */
@Injectable()
export class AccrualsService {
  private readonly logger = new Logger(AccrualsService.name);

  constructor(
    private readonly accrual: InterestAccrualService,
    private readonly capitalisation: CapitalisationService,
    private readonly overdraft: OverdraftFeeService,
    private readonly fees: FeeAssessmentService,
    private readonly clock: ClockService,
    @InjectQueue(ACCRUALS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Close one business date. Defaults to today on the simulation clock. */
  async runDaily(businessDate?: string): Promise<AccrualRunReport> {
    const date = businessDate ?? this.clock.today();
    if (!ISO_DATE_PATTERN.test(date)) {
      throw new ValidationError('Expected an ISO calendar date (YYYY-MM-DD)', [
        { path: 'businessDate', message: `Received "${date}"` },
      ]);
    }
    const asOf = this.clock.now();

    this.logger.log({ businessDate: date }, 'Accrual run started');
    const report: AccrualRunReport = {
      businessDate: date,
      accrual: await this.accrual.run(date, asOf),
      capitalisation: await this.capitalisation.run(date, asOf),
      overdraft: await this.overdraft.run(date, asOf),
      fees: await this.fees.run(date, asOf),
    };
    this.logger.log({ businessDate: date }, 'Accrual run complete');
    return report;
  }

  /** Queue a daily run for workers; returns the deterministic job id. */
  async enqueueDailyRun(businessDate?: string): Promise<string> {
    const date = businessDate ?? this.clock.today();
    if (!ISO_DATE_PATTERN.test(date)) {
      throw new ValidationError('Expected an ISO calendar date (YYYY-MM-DD)', [
        { path: 'businessDate', message: `Received "${date}"` },
      ]);
    }
    const jobId = dailyRunJobId(date);
    await this.queue.add(ACCRUAL_JOB_NAMES.dailyRun, { businessDate: date }, { jobId });
    return jobId;
  }
}
