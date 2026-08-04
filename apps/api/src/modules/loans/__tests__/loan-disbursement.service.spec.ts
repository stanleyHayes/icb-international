import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import type { LoanApplicationDoc } from '../infrastructure/loan-application.schemas.js';
import type { LoanDoc } from '../infrastructure/loan.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoanDisbursementService } from '../loan-disbursement.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const SESSION = { id: 'session-1' } as unknown as ClientSession;
const ACTOR = { kind: 'staff', id: 'staff-1', label: 'Loans ops' } as const;

function applicationDoc(overrides: Partial<LoanApplicationDoc> = {}): LoanApplicationDoc {
  return {
    _id: 'app-1',
    reference: 'LNA-TEST',
    customerId: 'cust-1',
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal loan',
    status: 'accepted',
    requestedMinorUnits: 500_000,
    currency: 'USD',
    termMonths: 12,
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
    offer: {
      amountMinorUnits: 500_000,
      rate: 12.5,
      instalmentMinorUnits: 44_500,
      expiresAt: new Date(NOW.getTime() + 7 * 86_400_000),
      acceptedAt: NOW,
    },
    loanId: null,
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup() {
  const repository = {
    loans: {
      create: vi.fn().mockResolvedValue([]),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    },
    applications: { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) },
    requireLoan: vi.fn(),
  };
  const accounts = { loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-1' }) };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const transactionManager = {
    withTransaction: vi.fn((fn: (session: ClientSession) => unknown) => fn(SESSION)),
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
  return { service, repository, accounts, ledger, transactionManager };
}

async function bookedLoan(deps: ReturnType<typeof setup>): Promise<LoanDoc> {
  return deps.service.book(applicationDoc(), SESSION);
}

describe('LoanDisbursementService.book', () => {
  it('refuses to book before the offer is accepted', async () => {
    const { service, repository } = setup();
    const application = applicationDoc({ offer: null });

    await expect(service.book(application, SESSION)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.loans.create).not.toHaveBeenCalled();
  });

  it('refuses to book an offer that is still open', async () => {
    const { service } = setup();
    const application = applicationDoc();
    (application.offer as { acceptedAt: Date | null }).acceptedAt = null;

    await expect(service.book(application, SESSION)).rejects.toBeInstanceOf(ConflictError);
  });

  it('creates an approved, undrawn loan with a re-anchored schedule', async () => {
    const deps = setup();

    const loan = await bookedLoan(deps);

    expect(loan.status).toBe('approved');
    expect(loan.disbursedAt).toBeNull();
    expect(loan.principalMinorUnits).toBe(500_000);
    expect(loan.schedule).toHaveLength(12);
    expect(loan.instalmentMinorUnits).toBeGreaterThan(0);
    expect(loan.createdAt).toEqual(NOW);
    expect(deps.repository.loans.create).toHaveBeenCalledWith(
      [loan],
      { session: SESSION, ordered: true },
    );
  });
});

describe('LoanDisbursementService.disburse', () => {
  let deps: ReturnType<typeof setup>;
  let loan: LoanDoc;

  beforeEach(async () => {
    deps = setup();
    loan = await bookedLoan(deps);
    deps.repository.requireLoan.mockResolvedValue(loan);
  });

  it('refuses a loan that is not awaiting drawdown', async () => {
    deps.repository.requireLoan.mockResolvedValue({ ...loan, status: 'active' });

    await expect(deps.service.disburse(loan._id, ACTOR)).rejects.toBeInstanceOf(ConflictError);
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
  });

  it('refuses a loan that has already been drawn', async () => {
    deps.repository.requireLoan.mockResolvedValue({ ...loan, disbursedAt: NOW });

    await expect(deps.service.disburse(loan._id, ACTOR)).rejects.toBeInstanceOf(ConflictError);
  });

  it('posts the drawdown and flips the loan to active', async () => {
    const result = await deps.service.disburse(loan._id, ACTOR);

    expect(deps.accounts.loadSpendable).toHaveBeenCalledWith(loan.accountId, loan.customerId);
    const [posting, session] = deps.ledger.postWithin.mock.calls[0] as [
      { type: string; sourceType: string; sourceId: string; lines: { direction: string }[] },
      ClientSession,
    ];
    expect(posting.type).toBe('loan_disbursement');
    expect(posting.sourceType).toBe('loan');
    expect(posting.sourceId).toBe(loan._id);
    expect(posting.lines.map((line) => line.direction)).toEqual(['debit', 'credit']);
    expect(session).toBe(SESSION);

    const [filter, update] = deps.repository.loans.updateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(filter).toEqual({ _id: loan._id });
    expect(update.$set).toMatchObject({
      status: 'active',
      outstandingPrincipalMinorUnits: 500_000,
      lastAccrualOn: '2026-08-04',
      disbursedAt: NOW,
      disbursementTransactionId: 'txn-1',
    });
    expect(deps.repository.applications.updateOne).toHaveBeenCalledWith(
      { _id: loan.applicationId },
      { $set: { status: 'active', updatedAt: NOW } },
      { session: SESSION },
    );
    expect(result.status).toBe('active');
    expect(result.disbursedAt).toBe(NOW.toISOString());
  });
});
