import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { LoanApplicationDoc } from '../infrastructure/loan-application.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoanApplicationsService } from '../loan-applications.service.js';
import type { LoanDisbursementService } from '../loan-disbursement.service.js';
import type { LoanUnderwritingService } from '../loan-underwriting.service.js';
import { NOW, applicationDoc, loanDoc, storedOffer } from './fixtures.js';

const SESSION = 'session';

function setup(application: LoanApplicationDoc | null = null) {
  const applications = {
    create: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const repository = {
    applications,
    listApplicationsForCustomer: vi.fn().mockResolvedValue([applicationDoc()]),
    requireApplication: vi.fn().mockImplementation(() => {
      if (!application) {
        return Promise.reject(new NotFoundError('Loan application', 'app-1'));
      }
      return Promise.resolve(application);
    }),
    listUnderwritingQueue: vi.fn().mockResolvedValue([applicationDoc()]),
  };
  const underwriting = {
    assess: vi.fn(),
    override: vi.fn().mockResolvedValue(applicationDoc({ status: 'offered' })),
  };
  const disbursement = { book: vi.fn().mockResolvedValue(loanDoc({ _id: 'loan-9' })) };
  const accounts = { loadSpendable: vi.fn() };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoanApplicationsService(
    repository as unknown as LoansRepository,
    underwriting as unknown as LoanUnderwritingService,
    disbursement as unknown as LoanDisbursementService,
    accounts as unknown as AccountsService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, applications, repository, underwriting, disbursement };
}

function offeredDoc(overrides: Partial<LoanApplicationDoc> = {}): LoanApplicationDoc {
  return applicationDoc({ status: 'offered', offer: storedOffer(), ...overrides });
}

describe('LoanApplicationsService.listForCustomer / getForCustomer', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup(offeredDoc());
  });

  it('lists the customer’s applications mapped to the contract', async () => {
    const result = await context.service.listForCustomer('cust-1');

    expect(context.repository.listApplicationsForCustomer).toHaveBeenCalledWith('cust-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'app-1', customerId: 'cust-1' });
  });

  it('loads one application with ownership enforced by the query', async () => {
    const result = await context.service.getForCustomer('app-1', 'cust-1');

    expect(context.repository.requireApplication).toHaveBeenCalledWith('app-1', 'cust-1');
    expect(result.id).toBe('app-1');
    expect(result.offer?.expiresAt).toBe('2026-08-11T10:00:00.000Z');
  });

  it('propagates the typed not-found for another customer’s application', async () => {
    context = setup(null);

    await expect(context.service.getForCustomer('app-1', 'cust-2')).rejects.toThrow(NotFoundError);
  });
});

describe('LoanApplicationsService.accept', () => {
  it('books the loan and marks the offer accepted inside one transaction', async () => {
    const context = setup(offeredDoc());

    const result = await context.service.accept('app-1', 'cust-1');

    const acceptedOffer = { ...storedOffer(), acceptedAt: NOW };
    expect(context.disbursement.book).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'app-1', offer: acceptedOffer }),
      SESSION,
    );
    expect(context.applications.updateOne).toHaveBeenCalledWith(
      { _id: 'app-1' },
      { $set: { offer: acceptedOffer, status: 'approved', loanId: 'loan-9', updatedAt: NOW } },
      { session: SESSION },
    );
    expect(result.status).toBe('approved');
    expect(result.offer?.acceptedAt).toBe(NOW.toISOString());
  });

  it('propagates the typed not-found before opening a transaction', async () => {
    const context = setup(null);

    await expect(context.service.accept('app-1', 'cust-2')).rejects.toThrow(NotFoundError);
    expect(context.disbursement.book).not.toHaveBeenCalled();
  });

  it('refuses when the application carries no offer', async () => {
    const context = setup(applicationDoc({ status: 'submitted' }));

    await expect(context.service.accept('app-1', 'cust-1')).rejects.toThrow(ConflictError);
    expect(context.disbursement.book).not.toHaveBeenCalled();
  });

  it('refuses when the application has moved past the offered state', async () => {
    const context = setup(applicationDoc({ status: 'under_review', offer: storedOffer() }));

    await expect(context.service.accept('app-1', 'cust-1')).rejects.toThrow(ConflictError);
    expect(context.disbursement.book).not.toHaveBeenCalled();
  });

  it('refuses an offer that was already accepted', async () => {
    const context = setup(offeredDoc({ offer: storedOffer({ acceptedAt: NOW }) }));

    await expect(context.service.accept('app-1', 'cust-1')).rejects.toThrow(ConflictError);
    expect(context.disbursement.book).not.toHaveBeenCalled();
  });

  it('refuses an offer expiring exactly at the frozen clock', async () => {
    const context = setup(offeredDoc({ offer: storedOffer({ expiresAt: NOW }) }));

    await expect(context.service.accept('app-1', 'cust-1')).rejects.toThrow(ConflictError);
    expect(context.disbursement.book).not.toHaveBeenCalled();
  });
});

describe('LoanApplicationsService.queue', () => {
  it('defaults to a queue page of fifty', async () => {
    const context = setup(offeredDoc());

    const result = await context.service.queue();

    expect(context.repository.listUnderwritingQueue).toHaveBeenCalledWith(50);
    expect(result).toHaveLength(1);
  });

  it('passes an explicit limit through to the repository', async () => {
    const context = setup(offeredDoc());

    await context.service.queue(5);

    expect(context.repository.listUnderwritingQueue).toHaveBeenCalledWith(5);
  });
});

describe('LoanApplicationsService.decideByStaff', () => {
  it('delegates the override and returns the mapped decision', async () => {
    const context = setup(offeredDoc());
    const request = { outcome: 'approved' as const, approvedRate: 11.9 };

    const result = await context.service.decideByStaff('app-1', 'staff-1', request);

    expect(context.underwriting.override).toHaveBeenCalledWith('app-1', 'staff-1', request);
    expect(result).toMatchObject({ id: 'app-1', status: 'offered' });
  });

  it('propagates an underwriting rejection', async () => {
    const context = setup(offeredDoc());
    context.underwriting.override.mockRejectedValue(new ConflictError('Already decided'));

    await expect(
      context.service.decideByStaff('app-1', 'staff-1', { outcome: 'declined' }),
    ).rejects.toThrow(ConflictError);
  });
});
