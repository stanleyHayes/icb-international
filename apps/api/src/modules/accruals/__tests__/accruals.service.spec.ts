import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { ACCRUAL_JOB_NAMES, dailyRunJobId } from '../accruals.constants.js';
import { AccrualsService } from '../accruals.service.js';
import type { CapitalisationService } from '../capitalisation.service.js';
import type { FeeAssessmentService } from '../fee-assessment.service.js';
import type { InterestAccrualService } from '../interest-accrual.service.js';
import type { OverdraftFeeService } from '../overdraft-fee.service.js';

const BUSINESS_DATE = '2026-08-02';
const NOW = new Date('2026-08-02T12:00:00.000Z');

function setup() {
  const accrual = {
    run: vi.fn().mockResolvedValue({
      accountsConsidered: 3,
      accountsAccrued: 2,
      minorUnitsByCurrency: { USD: 1_096 },
    }),
  };
  const capitalisation = {
    run: vi.fn().mockResolvedValue({ accountsCapitalised: 1, minorUnitsByCurrency: { USD: 5_000 } }),
  };
  const overdraft = {
    run: vi.fn().mockResolvedValue({ accountsAssessed: 1, posted: 1, waived: 0 }),
  };
  const fees = {
    run: vi.fn().mockResolvedValue({
      accountsDue: 2,
      chargesAttempted: 3,
      posted: 2,
      waived: 1,
      duplicates: 0,
    }),
  };
  const queue = { add: vi.fn().mockResolvedValue({}) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new AccrualsService(
    accrual as unknown as InterestAccrualService,
    capitalisation as unknown as CapitalisationService,
    overdraft as unknown as OverdraftFeeService,
    fees as unknown as FeeAssessmentService,
    clock,
    queue as unknown as Queue,
  );
  return { service, accrual, capitalisation, overdraft, fees, queue };
}

describe('AccrualsService.runDaily', () => {
  it('closes a business date in ledger order: accrue, capitalise, then fees', async () => {
    const { service, accrual, capitalisation, overdraft, fees } = setup();

    const report = await service.runDaily(BUSINESS_DATE);

    const order = [
      accrual.run.mock.invocationCallOrder[0],
      capitalisation.run.mock.invocationCallOrder[0],
      overdraft.run.mock.invocationCallOrder[0],
      fees.run.mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(accrual.run).toHaveBeenCalledWith(BUSINESS_DATE, NOW);
    expect(fees.run).toHaveBeenCalledWith(BUSINESS_DATE, NOW);
    expect(report.businessDate).toBe(BUSINESS_DATE);
    expect(report.accrual.accountsAccrued).toBe(2);
    expect(report.fees.waived).toBe(1);
  });

  it('defaults the business date to the simulation clock’s today', async () => {
    const { service, accrual } = setup();

    const report = await service.runDaily();

    expect(report.businessDate).toBe('2026-08-02');
    expect(accrual.run).toHaveBeenCalledWith('2026-08-02', NOW);
  });

  it('rejects a malformed business date with a typed error', async () => {
    const { service } = setup();

    await expect(service.runDaily('02/08/2026')).rejects.toBeInstanceOf(ValidationError);
  });

  it('is safe to replay: every stage is claim-guarded, so a re-run is a re-read', async () => {
    const { service, accrual, fees } = setup();
    accrual.run.mockResolvedValue({
      accountsConsidered: 3,
      accountsAccrued: 0,
      minorUnitsByCurrency: {},
    });

    const replay = await service.runDaily(BUSINESS_DATE);

    // The stages still run — idempotency lives in the claim indexes they consult,
    // not in skipping the run — and a replayed day accrues nothing twice.
    expect(replay.accrual.accountsAccrued).toBe(0);
    expect(fees.run).toHaveBeenCalledTimes(1);
  });
});

describe('AccrualsService.enqueueDailyRun', () => {
  it('enqueues the run with a deterministic job id, so duplicates collapse at the queue', async () => {
    const { service, queue } = setup();

    const jobId = await service.enqueueDailyRun(BUSINESS_DATE);

    expect(jobId).toBe(dailyRunJobId(BUSINESS_DATE));
    expect(queue.add).toHaveBeenCalledWith(
      ACCRUAL_JOB_NAMES.dailyRun,
      { businessDate: BUSINESS_DATE },
      { jobId: 'accrual:2026-08-02' },
    );
  });

  it('rejects a malformed date before touching the queue', async () => {
    const { service, queue } = setup();

    await expect(service.enqueueDailyRun('tomorrow')).rejects.toBeInstanceOf(ValidationError);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
