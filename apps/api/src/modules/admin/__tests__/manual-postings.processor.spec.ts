import type { Job, Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  ADMIN_POSTING_JOB_NAMES,
  APPROVED_POSTINGS_SCHEDULER_ID,
  APPROVED_POSTINGS_SWEEP_MS,
} from '../manual-postings.constants.js';
import { ManualPostingsProcessor } from '../manual-postings.processor.js';
import type { ManualPostingsService } from '../manual-postings.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

function makeHarness(options: { backgroundJobsEnabled?: boolean } = {}) {
  const jobs = { upsertJobScheduler: vi.fn().mockResolvedValue({}) };
  const dlq = { add: vi.fn().mockResolvedValue({}) };
  const clock = new ClockService();
  clock.freeze(NOW);
  const config = {
    backgroundJobs: { enabled: options.backgroundJobsEnabled ?? true },
  } as AppConfiguration;
  const manualPostings = { executeApproved: vi.fn().mockResolvedValue(2) };
  const processor = new ManualPostingsProcessor(
    jobs as unknown as Queue,
    dlq as unknown as Queue,
    clock,
    config,
    manualPostings as unknown as ManualPostingsService,
  );
  return { processor, jobs, dlq, manualPostings };
}

function job(name: string = ADMIN_POSTING_JOB_NAMES.sweepApproved): Job<Record<string, never>, number> {
  return { id: 'job-1', name, data: {}, opts: { attempts: 1 }, attemptsMade: 0 } as Job<
    Record<string, never>,
    number
  >;
}

describe('ManualPostingsProcessor.onModuleInit', () => {
  it('registers the repeatable sweep under the fixed scheduler id', async () => {
    const { processor, jobs } = makeHarness();

    await processor.onModuleInit();

    expect(jobs.upsertJobScheduler).toHaveBeenCalledWith(
      APPROVED_POSTINGS_SCHEDULER_ID,
      { every: APPROVED_POSTINGS_SWEEP_MS },
      { name: ADMIN_POSTING_JOB_NAMES.sweepApproved, data: {} },
    );
  });

  it('schedules nothing when background jobs are disabled', async () => {
    const { processor, jobs } = makeHarness({ backgroundJobsEnabled: false });

    await processor.onModuleInit();

    expect(jobs.upsertJobScheduler).not.toHaveBeenCalled();
  });
});

describe('ManualPostingsProcessor.process', () => {
  it('delegates the sweep to the service and returns the posted count', async () => {
    const { processor, manualPostings } = makeHarness();

    const result = await processor.process(job());

    expect(manualPostings.executeApproved).toHaveBeenCalledTimes(1);
    expect(result).toBe(2);
  });

  it('rejects an unknown job name with a typed error', async () => {
    const { processor } = makeHarness();

    await expect(processor.process(job('something-else'))).rejects.toBeInstanceOf(DomainError);
  });

  it('dead-letters a sweep that exhausts its retries', async () => {
    const { processor, manualPostings, dlq } = makeHarness();
    manualPostings.executeApproved.mockRejectedValue(new Error('mongo down'));
    const exhausted = { ...job(), attemptsMade: 1, opts: { attempts: 1 } };

    await expect(
      processor.process(exhausted as Job<Record<string, never>, number>),
    ).rejects.toThrow('mongo down');

    expect(dlq.add).toHaveBeenCalledWith(
      'exhausted-job',
      expect.objectContaining({ originJobId: 'job-1', failedReason: 'mongo down' }),
      expect.anything(),
    );
  });
});
