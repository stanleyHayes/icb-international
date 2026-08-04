import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, DomainError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { PostingActor, PostingCommand } from '../../ledger/domain/posting.types.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import type { LoanDoc } from '../infrastructure/loan.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoanDisbursementService } from '../loan-disbursement.service.js';
import { NOW, SESSION, TODAY, approvedLoanDoc } from './fixtures.js';

const ACTOR: PostingActor = { kind: 'staff', id: 'staff-1', label: 'Back office' };

function setup(loan: LoanDoc = approvedLoanDoc()) {
  const loans = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const applications = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const repository = {
    loans,
    applications,
    requireLoan: vi.fn().mockResolvedValue(loan),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-1', currency: 'USD' }),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const transactionManager = {
    withTransaction: vi.fn(<T,>(work: (session: ClientSession) => Promise<T>): Promise<T> =>
      work(SESSION),
    ),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoanDisbursementService(
    repository as unknown as LoansRepository,
    accounts as unknown as AccountsService,
    ledger as unknown as LedgerService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, repository, loans, applications, accounts, ledger, transactionManager };
}

describe('LoanDisbursementService.disburse', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('advances the principal as one balanced posting and activates the loan', async () => {
    const loan = await context.service.disburse('loan-1', ACTOR);

    expect(context.accounts.loadSpendable).toHaveBeenCalledWith('acct-1', 'cust-1');
    expect(context.transactionManager.withTransaction).toHaveBeenCalledOnce();

    const command = context.ledger.postWithin.mock.calls[0]?.[0] as PostingCommand;
    expect(command.type).toBe('loan_disbursement');
    expect(command.description).toBe('Drawdown of loan LN-TESTREF');
    expect(command.actor).toBe(ACTOR);
    expect(command.sourceType).toBe('loan');
    expect(command.sourceId).toBe('loan-1');
    expect(command.reference).toMatch(/^DSB-/);
    expect(command.lines).toEqual([
      {
        accountRef: 'gl:1100',
        direction: 'debit',
        amount: { minorUnits: 500_000, currency: 'USD' },
        narrative: 'Loan LN-TESTREF advanced',
      },
      {
        accountRef: 'acct:acct-1',
        direction: 'credit',
        amount: { minorUnits: 500_000, currency: 'USD' },
        narrative: 'Loan LN-TESTREF drawdown',
      },
    ]);
    expect(context.ledger.postWithin.mock.calls[0]?.[1]).toBe(SESSION);

    expect(loan.status).toBe('active');
    expect(loan.outstandingPrincipal.minorUnits).toBe(500_000);
    expect(loan.disbursedAt).toBe(NOW.toISOString());
    expect(loan.nextPaymentOn).toBe('2026-09-04');
  });

  it('re-anchors the schedule to the drawdown date and stamps the servicing state', async () => {
    await context.service.disburse('loan-1', ACTOR);

    const [filter, update, options] = context.loans.updateOne.mock.calls[0] ?? [];
    expect(filter).toEqual({ _id: 'loan-1' });
    expect(options).toEqual({ session: SESSION });

    const patch = (update as { $set: Partial<LoanDoc> }).$set;
    expect(patch.status).toBe('active');
    expect(patch.outstandingPrincipalMinorUnits).toBe(500_000);
    expect(patch.lastAccrualOn).toBe(TODAY);
    expect(patch.disbursedAt).toEqual(NOW);
    expect(patch.disbursementTransactionId).toBe('txn-1');
    expect(patch.updatedAt).toEqual(NOW);
    expect(patch.schedule).toHaveLength(24);
    expect(patch.schedule?.[0]?.dueOn).toBe('2026-09-04');
    expect(patch.maturesOn).toBe(patch.schedule?.at(-1)?.dueOn);

    expect(context.applications.updateOne).toHaveBeenCalledWith(
      { _id: 'app-1' },
      { $set: { status: 'active', updatedAt: NOW } },
      { session: SESSION },
    );
  });

  it('refuses a loan that is not awaiting drawdown', async () => {
    const { service, ledger, loans } = setup(approvedLoanDoc({ status: 'active', disbursedAt: NOW }));

    await expect(service.disburse('loan-1', ACTOR)).rejects.toThrow(ConflictError);
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(loans.updateOne).not.toHaveBeenCalled();
  });

  it('refuses a second drawdown when the loan is approved but already disbursed', async () => {
    const { service, ledger, loans } = setup(approvedLoanDoc({ disbursedAt: NOW }));

    await expect(service.disburse('loan-1', ACTOR)).rejects.toThrow(ConflictError);
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(loans.updateOne).not.toHaveBeenCalled();
  });

  it('checks the destination account before any money moves', async () => {
    context.accounts.loadSpendable.mockRejectedValue(
      new DomainError('ACCOUNT_FROZEN', 'This account is frozen'),
    );

    await expect(context.service.disburse('loan-1', ACTOR)).rejects.toThrow(DomainError);
    expect(context.transactionManager.withTransaction).not.toHaveBeenCalled();
    expect(context.ledger.postWithin).not.toHaveBeenCalled();
    expect(context.loans.updateOne).not.toHaveBeenCalled();
  });

  it('propagates the not-found for an unknown loan', async () => {
    context.repository.requireLoan.mockRejectedValue(new NotFoundError('Loan', 'loan-9'));

    await expect(context.service.disburse('loan-9', ACTOR)).rejects.toThrow(NotFoundError);
    expect(context.ledger.postWithin).not.toHaveBeenCalled();
  });
});
