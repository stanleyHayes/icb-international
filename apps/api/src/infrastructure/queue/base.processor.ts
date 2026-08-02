import { Logger } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { DEAD_LETTER_JOB_NAME } from './queue.constants.js';

/** Snapshot of a job that exhausted its retries, preserved on the dead-letter queue. */
export interface DeadLetterRecord<TData = unknown> {
  readonly originQueue: string;
  readonly originJobId: string;
  readonly jobName: string;
  readonly data: TData;
  readonly failedReason: string;
  readonly attemptsMade: number;
  readonly deadLetteredAt: string;
}

/**
 * Base class for every BullMQ worker.
 *
 * Subclasses declare `@Processor('queue-name')`, implement `handle`, and inject the dead-letter
 * queue plus the clock:
 *
 * ```ts
 * constructor(@InjectQueue(DEAD_LETTER_QUEUE) dlq: Queue, clock: ClockService) {
 *   super(dlq, clock);
 * }
 * ```
 *
 * Retry with exponential backoff comes from the queue's default job options (see
 * queue.constants.ts). This class owns the end of that ladder: when the final attempt fails the
 * job is copied onto the dead-letter queue with its payload and failure reason, so a poisoned
 * job is never silently dropped and can be replayed by operations after the cause is fixed.
 */
export abstract class BaseJobProcessor<TData = unknown, TResult = unknown> extends WorkerHost {
  protected abstract readonly logger: Logger;

  protected constructor(
    private readonly deadLetterQueue: Queue,
    private readonly clock: ClockService,
  ) {
    super();
  }

  async process(job: Job<TData, TResult>): Promise<TResult> {
    try {
      return await this.handle(job);
    } catch (error) {
      await this.onAttemptFailed(job, error);
      throw error;
    }
  }

  protected abstract handle(job: Job<TData, TResult>): Promise<TResult>;

  private async onAttemptFailed(job: Job<TData, TResult>, error: unknown): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    this.logger.warn(
      { jobId: job.id, attempt: job.attemptsMade, maxAttempts, err: error },
      'Job attempt failed',
    );
    if (job.attemptsMade >= maxAttempts) {
      await this.moveToDeadLetter(job, error);
    }
  }

  private async moveToDeadLetter(job: Job<TData, TResult>, error: unknown): Promise<void> {
    const record: DeadLetterRecord<TData> = {
      originQueue: job.queueName,
      originJobId: job.id ?? 'unknown',
      jobName: job.name,
      data: job.data,
      failedReason: error instanceof Error ? error.message : String(error),
      attemptsMade: job.attemptsMade,
      deadLetteredAt: this.clock.now().toISOString(),
    };
    await this.deadLetterQueue.add(DEAD_LETTER_JOB_NAME, record, {
      removeOnComplete: false,
      removeOnFail: false,
    });
    this.logger.error(
      { jobId: job.id, originQueue: job.queueName, attemptsMade: job.attemptsMade },
      'Job exhausted retries; moved to dead-letter queue',
    );
  }
}
