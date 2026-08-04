import { describe, expect, it, vi } from 'vitest';

import type {
  ExternalCollections,
  LoanRow,
  ScheduleRow,
} from '../infrastructure/external-collections.js';
import { ArrearsAgeingStep } from '../steps/arrears-ageing.step.js';
import { BUSINESS_DATE, CONTEXT, NOW } from './fixtures.js';

function instalment(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    number: 1,
    dueOn: '2026-08-01',
    instalmentMinorUnits: 10_000,
    paidMinorUnits: 0,
    status: 'scheduled',
    ...overrides,
  };
}

function loan(overrides: Partial<LoanRow> = {}): LoanRow {
  return {
    _id: 'loan-1',
    customerId: 'cust-1',
    status: 'active',
    currency: 'USD',
    schedule: [instalment()],
    ...overrides,
  };
}

function setup(loans: LoanRow[], modifiedCount = 1) {
  const loansCollection = {
    find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(loans) }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount }),
  };
  const external = { loans: vi.fn().mockReturnValue(loansCollection) };

  const step = new ArrearsAgeingStep(external as unknown as ExternalCollections);
  return { step, loansCollection };
}

describe('ArrearsAgeingStep', () => {
  it('selects active loans with a past-due instalment', async () => {
    const { step, loansCollection } = setup([]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(0);
    expect(loansCollection.find).toHaveBeenCalledWith({
      status: 'active',
      'schedule.dueOn': { $lt: BUSINESS_DATE },
    });
  });

  it('marks past-due scheduled instalments overdue and counts the loan once', async () => {
    const { step, loansCollection } = setup([
      loan({ schedule: [instalment(), instalment({ number: 2, dueOn: '2026-08-03' })] }),
    ]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(1);
    expect(loansCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'loan-1' },
      { $set: { 'schedule.$[late].status': 'overdue', updatedAt: NOW } },
      { arrayFilters: [{ 'late.number': { $in: [1, 2] }, 'late.status': 'scheduled' }] },
    );
  });

  it('still ages an instalment that is only partially paid', async () => {
    const { step, loansCollection } = setup([
      loan({ schedule: [instalment({ paidMinorUnits: 9_999 })] }),
    ]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(1);
    expect(loansCollection.updateOne).toHaveBeenCalled();
  });

  it('leaves settled instalments scheduled', async () => {
    const { step, loansCollection } = setup([
      loan({ schedule: [instalment({ paidMinorUnits: 10_000 })] }),
    ]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(0);
    expect(loansCollection.updateOne).not.toHaveBeenCalled();
  });

  it('does not age an instalment due on the business date itself', async () => {
    const { step, loansCollection } = setup([
      loan({ schedule: [instalment({ dueOn: BUSINESS_DATE })] }),
    ]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(0);
    expect(loansCollection.updateOne).not.toHaveBeenCalled();
  });

  it('never reselects an instalment already marked overdue', async () => {
    const { step, loansCollection } = setup([
      loan({ schedule: [instalment({ status: 'overdue' })] }),
    ]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(0);
    expect(loansCollection.updateOne).not.toHaveBeenCalled();
  });

  it('counts nothing when a concurrent run already aged the instalments', async () => {
    const { step } = setup([loan()], 0);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(0);
  });

  it('ages each loan that changed and sums them', async () => {
    const { step } = setup([loan(), loan({ _id: 'loan-2' })]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(2);
  });

  it('tolerates a loan with no schedule array at all', async () => {
    const { step, loansCollection } = setup([
      { ...loan(), schedule: undefined as unknown as ScheduleRow[] },
    ]);

    const aged = await step.run(CONTEXT);

    expect(aged).toBe(0);
    expect(loansCollection.updateOne).not.toHaveBeenCalled();
  });
});
