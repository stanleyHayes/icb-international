import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { LoanApplicationDoc } from '../infrastructure/loan-application.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoanApplicationsService } from '../loan-applications.service.js';
import type { LoanDisbursementService } from '../loan-disbursement.service.js';
import type { LoanUnderwritingService } from '../loan-underwriting.service.js';
import { NOW, applicationDoc, applicationRequest } from './fixtures.js';

function setup(assessed: LoanApplicationDoc = applicationDoc({ status: 'under_review' })) {
  const applications = {
    create: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const repository = { applications };
  const underwriting = { assess: vi.fn().mockResolvedValue(assessed) };
  const disbursement = { book: vi.fn() };
  const accounts = { loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-1' }) };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work('session')),
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
  return { service, applications, underwriting, disbursement, accounts, assessed };
}

function createdDocument(applications: ReturnType<typeof setup>['applications']): LoanApplicationDoc {
  const [documents, options] = applications.create.mock.calls[0] as [LoanApplicationDoc[], unknown];
  expect(options).toEqual({ ordered: true });
  const [document] = documents;
  expect(document).toBeDefined();
  return document as LoanApplicationDoc;
}

describe('LoanApplicationsService.create', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('persists a submitted application stamped from the frozen clock, then returns the assessment', async () => {
    const result = await context.service.create('cust-1', applicationRequest());

    const document = createdDocument(context.applications);
    expect(document).toMatchObject({
      customerId: 'cust-1',
      productCode: 'PERSONAL_STANDARD',
      productName: 'Personal Loan',
      status: 'submitted',
      requestedMinorUnits: 500_000,
      currency: 'USD',
      termMonths: 36,
      frequency: 'monthly',
      purpose: 'home_improvement',
      purposeDetail: null,
      disbursementAccountId: 'acct-1',
      repaymentAccountId: 'acct-1',
      declaredMonthlyIncomeMinorUnits: 300_000,
      declaredMonthlyExpensesMinorUnits: 120_000,
      existingCommitmentsMinorUnits: 20_000,
      documents: [],
      decision: null,
      offer: null,
      loanId: null,
      submittedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(document.reference).toMatch(/^LNA-/);
    expect(context.underwriting.assess).toHaveBeenCalledWith(document._id, 'scorecard');
    expect(result).toMatchObject({
      id: context.assessed._id,
      status: 'under_review',
      requestedAmount: { minorUnits: 500_000, currency: 'USD' },
    });
  });

  it('persists an optional purpose detail when the applicant supplies one', async () => {
    await context.service.create(
      'cust-1',
      applicationRequest({ purposeDetail: 'Replacing the kitchen' }),
    );

    expect(createdDocument(context.applications).purposeDetail).toBe('Replacing the kitchen');
  });

  it('checks each servicing account once when disbursement and repayment differ', async () => {
    await context.service.create('cust-1', applicationRequest({ repaymentAccountId: 'acct-2' }));

    expect(context.accounts.loadSpendable).toHaveBeenCalledTimes(2);
    expect(context.accounts.loadSpendable).toHaveBeenNthCalledWith(1, 'acct-1', 'cust-1');
    expect(context.accounts.loadSpendable).toHaveBeenNthCalledWith(2, 'acct-2', 'cust-1');
  });

  it('checks the servicing account only once when one account plays both roles', async () => {
    await context.service.create('cust-1', applicationRequest());

    expect(context.accounts.loadSpendable).toHaveBeenCalledTimes(1);
    expect(context.accounts.loadSpendable).toHaveBeenCalledWith('acct-1', 'cust-1');
  });

  it('refuses an unknown product code before touching the accounts or the store', async () => {
    await expect(
      context.service.create('cust-1', applicationRequest({ productCode: 'NOPE' })),
    ).rejects.toThrow(NotFoundError);
    expect(context.accounts.loadSpendable).not.toHaveBeenCalled();
    expect(context.applications.create).not.toHaveBeenCalled();
  });

  it('refuses a currency the product is not sold in', async () => {
    await expect(
      context.service.create(
        'cust-1',
        // Deliberately not the catalogue currency — that is what this test proves is refused.
        applicationRequest({ amount: { minorUnits: 500_000, currency: 'GBP', scale: 2 } }),
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error);
    expect(context.applications.create).not.toHaveBeenCalled();
  });

  it('propagates a servicing-account rejection and writes nothing', async () => {
    context.accounts.loadSpendable.mockRejectedValue(new NotFoundError('Account', 'acct-1'));

    await expect(context.service.create('cust-1', applicationRequest())).rejects.toThrow(
      NotFoundError,
    );
    expect(context.applications.create).not.toHaveBeenCalled();
    expect(context.underwriting.assess).not.toHaveBeenCalled();
  });
});
