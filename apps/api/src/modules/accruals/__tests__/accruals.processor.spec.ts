import type { Job, Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { ACCRUAL_JOB_NAMES } from '../accruals.constants.js';
import { AccrualsProcessor, type DailyRunJobData } from '../accruals.processor.js';
import type { AccrualsService, AccrualRunReport } from '../accruals.service.js';

const REPORT = { businessDate: '2026-08-02' } as AccrualRunReport;

function setup() {
  const accruals = { runDaily: vi.fn().mockResolvedValue(REPORT) };
  const dlq = { add: vi.fn().mockResolvedValue({}) };
  const clock = new ClockService();
  clock.freeze(new Date('2026-08-02T12:00:00.000Z'));
  const processor = new AccrualsProcessor(
    dlq as unknown as Queue,
    clock,
    accruals as unknown as AccrualsService,
  );
  return { processor, accruals, dlq };
}

function job(data: DailyRunJobData, name: string = ACCRUAL_JOB_NAMES.dailyRun): Job<DailyRunJobData, AccrualRunReport> {
  return { id: 'job-1', name, data, opts: { attempts: 1 }, attemptsMade: 0 } as Job<
    DailyRunJobData,
    AccrualRunReport
  >;
}

describe('AccrualsProcessor', () => {
  it('runs the daily close for the job’s business date', async () => {
    const { processor, accruals } = setup();

    const result = await processor.process(job({ businessDate: '2026-08-02' }));

    expect(accruals.runDaily).toHaveBeenCalledWith('2026-08-02');
    expect(result).toBe(REPORT);
  });

  it('rejects an unknown job name with a typed error', async () => {
    const { processor } = setup();

    await expect(processor.process(job({}, 'something-else'))).rejects.toBeInstanceOf(DomainError);
  });

  it('dead-letters a job that exhausts its retries', async () => {
    const { processor, accruals, dlq } = setup();
    accruals.runDaily.mockRejectedValue(new Error('mongo down'));
    const exhausted = { ...job({}), attemptsMade: 1, opts: { attempts: 1 } };

    await expect(processor.process(exhausted as Job<DailyRunJobData, AccrualRunReport>)).rejects.toThrow(
      'mongo down',
    );

    expect(dlq.add).toHaveBeenCalledWith(
      'exhausted-job',
      expect.objectContaining({ originJobId: 'job-1', failedReason: 'mongo down' }),
      expect.anything(),
    );
  });
});
