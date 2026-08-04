import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { LoanDoc } from '../infrastructure/loan.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoansService } from '../loans.service.js';
import { NOW, instalmentSub, loanDoc } from './fixtures.js';

/** The frozen business date every ageing assertion runs against. */
const TODAY = '2026-08-04';

function setup(loans: LoanDoc[] = [loanDoc()]) {
  const repository = {
    listLoansForCustomer: vi.fn().mockResolvedValue(loans),
    requireLoan: vi.fn().mockImplementation(() => {
      const [loan] = loans;
      if (!loan) {
        return Promise.reject(new NotFoundError('Loan', 'loan-1'));
      }
      return Promise.resolve(loan);
    }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoansService(repository as unknown as LoansRepository, clock);
  return { service, repository };
}

describe('LoansService.listForCustomer', () => {
  it('ages each loan on the way out and attaches arrears only where money is late', async () => {
    const overdue = loanDoc({
      _id: 'loan-2',
      status: 'in_arrears',
      schedule: [instalmentSub({ dueOn: '2026-07-05' })],
    });
    const { service, repository } = setup([loanDoc(), overdue]);

    const result = await service.listForCustomer('cust-1');

    expect(repository.listLoansForCustomer).toHaveBeenCalledWith('cust-1');
    expect(result).toHaveLength(2);
    const [current, late] = result;
    expect(current?.arrears).toBeNull();
    expect(current?.nextPaymentOn).toBe('2026-09-04');
    expect(late?.arrears).toMatchObject({
      amount: { minorUnits: 23_500, currency: 'USD' },
      daysPastDue: 30,
      bucket: '30_59',
      missedInstalments: 1,
    });
  });
});

describe('LoansService.getForCustomer', () => {
  it('returns the detail with the schedule re-derived against today', async () => {
    const { service, repository } = setup([
      loanDoc({
        schedule: [
          instalmentSub({ number: 1, dueOn: '2026-07-04', paidMinorUnits: 23_500 }),
          instalmentSub({ number: 2, dueOn: '2026-08-04' }),
        ],
      }),
    ]);

    const detail = await service.getForCustomer('loan-1', 'cust-1');

    expect(repository.requireLoan).toHaveBeenCalledWith('loan-1', 'cust-1');
    expect(detail.repaymentAccountId).toBe('acct-1');
    expect(detail.schedule.map((row) => row.status)).toEqual(['paid', 'due']);
    expect(detail.schedule[0]?.paidAmount).toEqual({ minorUnits: 23_500, currency: 'USD', scale: 2 });
    expect(detail.arrears).toBeNull();
  });

  it('propagates the typed not-found for another customer’s loan', async () => {
    const { service } = setup([]);

    await expect(service.getForCustomer('loan-1', 'cust-2')).rejects.toThrow(NotFoundError);
  });
});

describe('LoansService.age', () => {
  let service: LoansService;

  beforeEach(() => {
    service = setup().service;
  });

  it('re-derives every schedule status from the calendar', () => {
    const aged = service.age(
      loanDoc({
        schedule: [
          instalmentSub({ number: 1, dueOn: '2026-07-04', paidMinorUnits: 23_500 }),
          instalmentSub({ number: 2, dueOn: '2026-08-03' }),
          instalmentSub({ number: 3, dueOn: '2026-08-04' }),
          instalmentSub({ number: 4, dueOn: '2026-09-04', paidMinorUnits: 5_000 }),
          instalmentSub({ number: 5, dueOn: '2026-10-04' }),
          instalmentSub({ number: 6, dueOn: '2026-11-04', status: 'written_off' }),
        ],
      }),
    );

    expect(aged.schedule.map((row) => row.status)).toEqual([
      'paid',
      'overdue',
      'due',
      'partially_paid',
      'scheduled',
      'written_off',
    ]);
  });

  it('never mutates the stored schedule', () => {
    const stored = loanDoc({ schedule: [instalmentSub({ dueOn: '2026-07-04' })] });

    service.age(stored);

    expect(stored.schedule[0]?.status).toBe('scheduled');
  });
});

describe('LoansService.arrearsFor', () => {
  let service: LoansService;

  beforeEach(() => {
    service = setup().service;
  });

  it('is null for a loan that is unpaid but not yet due', () => {
    expect(service.arrearsFor(loanDoc())).toBeNull();
  });

  it('is null when the overdue rows are already fully paid', () => {
    const loan = loanDoc({
      schedule: [instalmentSub({ dueOn: '2026-07-04', paidMinorUnits: 23_500 })],
    });

    expect(service.arrearsFor(loan)).toBeNull();
  });

  it('ages from the oldest unpaid instalment and sums what is still owed', () => {
    const loan = loanDoc({
      schedule: [
        instalmentSub({ number: 1, dueOn: '2026-07-05' }),
        instalmentSub({ number: 2, dueOn: '2026-08-03', paidMinorUnits: 10_000 }),
      ],
    });

    expect(service.arrearsFor(loan)).toEqual({
      // 23,500 unpaid in full, plus 13,500 still owed on a partly-paid 23,500 instalment.
      amount: { minorUnits: 37_000, currency: 'USD', scale: 2 },
      daysPastDue: 30,
      bucket: '30_59',
      missedInstalments: 2,
    });
  });
});

describe('LoansService.frequencyOf', () => {
  it('narrows the stored frequency for callers', () => {
    expect(LoansService.frequencyOf(loanDoc())).toBe('monthly');
    expect(LoansService.frequencyOf(loanDoc({ frequency: 'weekly' }))).toBe('weekly');
  });
});

describe('frozen clock sanity', () => {
  it('derives the business date from the frozen instant', () => {
    const clock = new ClockService();
    clock.freeze(NOW);

    expect(clock.today()).toBe(TODAY);
  });
});
