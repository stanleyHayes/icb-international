import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { BaseJobProcessor, type DeadLetterRecord } from '../base.processor.js';
import { DEAD_LETTER_JOB_NAME } from '../queue.constants.js';

interface Payload {
  transferId: string;
}

class TestProcessor extends BaseJobProcessor<Payload, string> {
  protected readonly logger = new Logger(TestProcessor.name);
  readonly handler = vi.fn<(job: Job<Payload, string>) => Promise<string>>();

  constructor(deadLetterQueue: Queue, clock: ClockService) {
    super(deadLetterQueue, clock);
  }

  protected handle(job: Job<Payload, string>): Promise<string> {
    return this.handler(job);
  }
}

function fakeJob(overrides: { attemptsMade?: number; attempts?: number } = {}): Job<Payload, string> {
  return {
    id: 'job-7',
    name: 'settle-transfer',
    queueName: 'transfers',
    data: { transferId: 'trf-1' },
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: overrides.attempts ?? 3 },
  } as unknown as Job<Payload, string>;
}

function setup() {
  const deadLetterQueue = { add: vi.fn() };
  const clock = new ClockService();
  clock.freeze(new Date('2026-08-02T12:00:00.000Z'));
  const processor = new TestProcessor(deadLetterQueue as unknown as Queue, clock);
  return { deadLetterQueue, processor };
}

describe('process', () => {
  it('returns the handler result on success', async () => {
    const { deadLetterQueue, processor } = setup();
    processor.handler.mockResolvedValue('done');

    await expect(processor.process(fakeJob())).resolves.toBe('done');
    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });

  it('rethrows a failure without dead-lettering while retries remain', async () => {
    const { deadLetterQueue, processor } = setup();
    const failure = new Error('mongo stepdown');
    processor.handler.mockRejectedValue(failure);

    await expect(processor.process(fakeJob({ attemptsMade: 2, attempts: 3 }))).rejects.toBe(
      failure,
    );
    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });

  it('moves the job to the dead-letter queue when the final attempt fails', async () => {
    const { deadLetterQueue, processor } = setup();
    processor.handler.mockRejectedValue(new Error('rail timeout'));

    await expect(processor.process(fakeJob({ attemptsMade: 3, attempts: 3 }))).rejects.toThrow(
      'rail timeout',
    );

    const record: DeadLetterRecord<Payload> = {
      originQueue: 'transfers',
      originJobId: 'job-7',
      jobName: 'settle-transfer',
      data: { transferId: 'trf-1' },
      failedReason: 'rail timeout',
      attemptsMade: 3,
      deadLetteredAt: '2026-08-02T12:00:00.000Z',
    };
    expect(deadLetterQueue.add).toHaveBeenCalledWith(DEAD_LETTER_JOB_NAME, record, {
      removeOnComplete: false,
      removeOnFail: false,
    });
  });

  it('treats a job without configured attempts as single-attempt', async () => {
    const { deadLetterQueue, processor } = setup();
    processor.handler.mockRejectedValue(new Error('boom'));
    const job = fakeJob({ attemptsMade: 1 });
    job.opts = {};

    await expect(processor.process(job)).rejects.toThrow('boom');
    expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
  });
});
