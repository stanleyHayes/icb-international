import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { LoanDoc } from '../infrastructure/loan.schemas.js';
import { LoanDisbursementService } from '../loan-disbursement.service.js';
import { NOW, SESSION, acceptedOffer, applicationDoc } from './fixtures.js';

function setup() {
  const loans = {
    create: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const repository = {
    loans: loans as unknown as Model<LoanDoc>,
    applications: { updateOne: vi.fn() } as never,
    requireLoan: vi.fn(),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoanDisbursementService(repository as never, {} as never, {} as never, {} as never, clock);
  return { service, repository, loans };
}

describe('LoanDisbursementService.book', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('books the accepted offer as an approved, undrawn loan inside the caller session', async () => {
    const application = applicationDoc();

    const booked = await context.service.book(application, SESSION);

    expect(context.loans.create).toHaveBeenCalledWith([booked], { session: SESSION, ordered: true });
    expect(booked.applicationId).toBe('app-1');
    expect(booked.customerId).toBe('cust-1');
    expect(booked.accountId).toBe('acct-1');
    expect(booked.status).toBe('approved');
    expect(booked.principalMinorUnits).toBe(500_000);
    expect(booked.outstandingPrincipalMinorUnits).toBe(0);
    expect(booked.accruedInterestMinorUnits).toBe(0);
    expect(booked.rate).toBeCloseTo(9.9, 4);
    expect(booked.disbursedAt).toBeNull();
    expect(booked.disbursementTransactionId).toBeNull();
    expect(booked.settledAt).toBeNull();
    expect(booked.lastAccrualOn).toBeNull();
    expect(booked.createdAt).toEqual(NOW);
    expect(booked.reference).toMatch(/^LN-/);
  });

  it('derives a full monthly schedule from the offer, starting one period out', async () => {
    const booked = await context.service.book(applicationDoc(), SESSION);

    expect(booked.schedule).toHaveLength(24);
    expect(booked.schedule[0]?.dueOn).toBe('2026-09-04');
    expect(booked.schedule[0]?.status).toBe('scheduled');
    expect(booked.schedule[0]?.paidMinorUnits).toBe(0);
    expect(booked.maturesOn).toBe(booked.schedule.at(-1)?.dueOn);
    expect(booked.instalmentMinorUnits).toBeGreaterThan(0);
    expect(booked.schedule[0]?.instalmentMinorUnits).toBe(booked.instalmentMinorUnits);
  });

  it('refuses to book an application whose offer has not been accepted', async () => {
    const application = applicationDoc({ offer: acceptedOffer({ acceptedAt: null }) });

    await expect(context.service.book(application, SESSION)).rejects.toThrow(ConflictError);
    expect(context.loans.create).not.toHaveBeenCalled();
  });

  it('refuses to book an application that carries no offer at all', async () => {
    const application = applicationDoc({ offer: null });

    await expect(context.service.book(application, SESSION)).rejects.toThrow(ConflictError);
    expect(context.loans.create).not.toHaveBeenCalled();
  });

  it('never touches requireLoan — booking works from the application alone', async () => {
    await context.service.book(applicationDoc(), SESSION);

    expect(context.repository.requireLoan).not.toHaveBeenCalled();
  });
});
