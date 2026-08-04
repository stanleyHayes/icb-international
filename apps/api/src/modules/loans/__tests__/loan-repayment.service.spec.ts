import { fromMinorUnits } from '@icb/money';
import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConflictError,
  DomainError,
  InsufficientFundsError,
  ValidationError,
} from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import type { InstalmentSub, LoanDoc } from '../infrastructure/loan.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoanRepaymentService, type RepaymentRequest } from '../loan-repayment.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const TODAY = '2026-08-04';
const SESSION = { id: 'session-1' } as unknown as ClientSession;

function instalment(number: number, overrides: Partial<InstalmentSub> = {}): InstalmentSub {
  return {
    number,
    dueOn: number === 1 ? '2026-09-04' : '2026-10-04',
    instalmentMinorUnits: 250_000,
    principalMinorUnits: 250_000,
    interestMinorUnits: 0,
    feesMinorUnits: 0,
    openingBalanceMinorUnits: number === 1 ? 500_000 : 250_000,
    closingBalanceMinorUnits: number === 1 ? 250_000 : 0,
    status: 'due',
    paidAt: null,
    paidMinorUnits: 0,
    ...overrides,
  };
}

function loanDoc(overrides: Partial<LoanDoc> = {}): LoanDoc {
  return {
    _id: 'loan-1',
    reference: 'LN-TEST',
    applicationId: 'app-1',
    customerId: 'cust-1',
    accountId: 'acct-1',
    repaymentAccountId: 'acct-1',
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal loan',
    status: 'active',
    currency: 'USD',
    principalMinorUnits: 500_000,
    outstandingPrincipalMinorUnits: 500_000,
    accruedInterestMinorUnits: 0,
    feesOutstandingMinorUnits: 0,
    rate: 0, // keeps accrued interest at zero so allocation is deterministic
    termMonths: 2,
    frequency: 'monthly',
    instalmentMinorUnits: 250_000,
    schedule: [instalment(1), instalment(2)],
    lastAccrualOn: TODAY,
    maturesOn: '2026-10-04',
    disbursedAt: NOW,
    disbursementTransactionId: 'txn-0',
    settledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function request(overrides: Partial<RepaymentRequest> = {}): RepaymentRequest {
  return {
    fromAccountId: 'acct-1',
    amount: { minorUnits: 250_000, currency: 'USD', scale: 2 },
    kind: 'scheduled',
    ...overrides,
  };
}

function setup({ loan = loanDoc() } = {}) {
  const repository = {
    loans: { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) },
    requireLoan: vi.fn().mockResolvedValue(loan),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-1', number: '10000001', currency: 'USD' }),
    balancesFor: vi.fn().mockResolvedValue({
      ledger: fromMinorUnits(600_000, 'USD'),
      holds: fromMinorUnits(0, 'USD'),
      available: fromMinorUnits(600_000, 'USD'),
    }),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const transactionManager = {
    withTransaction: vi.fn((fn: (session: ClientSession) => unknown) => fn(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoanRepaymentService(
    repository as unknown as LoansRepository,
    accounts as unknown as AccountsService,
    ledger as unknown as LedgerService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, repository, accounts, ledger };
}

describe('LoanRepaymentService.repay', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('rejects repayment on a loan that is not live', async () => {
    deps = setup({ loan: loanDoc({ status: 'settled' }) });

    await expect(deps.service.repay('loan-1', 'cust-1', request())).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('rejects a source account in the wrong currency', async () => {
    deps.accounts.loadSpendable.mockResolvedValue({ _id: 'acct-2', number: '1', currency: 'GHS' });

    await expect(deps.service.repay('loan-1', 'cust-1', request())).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('rejects an amount above the total outstanding', async () => {
    const tooBig = request({ amount: { minorUnits: 500_001, currency: 'USD', scale: 2 } });
    deps.accounts.balancesFor.mockResolvedValue({
      ledger: fromMinorUnits(600_000, 'USD'),
      holds: fromMinorUnits(0, 'USD'),
      available: fromMinorUnits(600_000, 'USD'),
    });

    await expect(deps.service.repay('loan-1', 'cust-1', tooBig)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
  });

  it('rejects a payoff below the settlement figure', async () => {
    const short = request({ kind: 'payoff', amount: { minorUnits: 250_000, currency: 'USD', scale: 2 } });

    await expect(deps.service.repay('loan-1', 'cust-1', short)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects when the source account cannot cover the payment', async () => {
    deps.accounts.balancesFor.mockResolvedValue({
      ledger: fromMinorUnits(100_000, 'USD'),
      holds: fromMinorUnits(0, 'USD'),
      available: fromMinorUnits(100_000, 'USD'),
    });

    await expect(deps.service.repay('loan-1', 'cust-1', request())).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
  });

  it('posts a principal-only waterfall when no interest or fees are due', async () => {
    const detail = await deps.service.repay('loan-1', 'cust-1', request());

    const [posting, session] = deps.ledger.postWithin.mock.calls[0] as [
      {
        type: string;
        lines: { accountRef: string; direction: string; amount: { minorUnits: number } }[];
      },
      ClientSession,
    ];
    expect(posting.type).toBe('loan_repayment');
    expect(posting.lines).toHaveLength(2); // zero components are omitted
    expect(posting.lines[0]).toMatchObject({
      accountRef: 'acct:acct-1',
      direction: 'debit',
      amount: { minorUnits: 250_000 },
    });
    expect(posting.lines[1]?.direction).toBe('credit');
    expect(posting.lines[1]?.accountRef.startsWith('gl:')).toBe(true);
    expect(session).toBe(SESSION);

    const [filter, update] = deps.repository.loans.updateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(filter).toEqual({ _id: 'loan-1' });
    expect(update.$set).toMatchObject({ outstandingPrincipalMinorUnits: 250_000 });
    expect(detail.outstandingPrincipal.minorUnits).toBe(250_000);
  });

  it('settles the loan on a full payoff', async () => {
    const loan = loanDoc();
    const payoff = request({
      kind: 'payoff',
      // 500_000 principal + 1% early-repayment fee on PERSONAL_STANDARD
      amount: { minorUnits: 505_000, currency: 'USD', scale: 2 },
    });

    await deps.service.repay(loan._id, loan.customerId, payoff);

    const [posting] = deps.ledger.postWithin.mock.calls[0] as [
      { lines: { direction: string; amount: { minorUnits: number } }[] },
    ];
    const credits = posting.lines.filter((line) => line.direction === 'credit');
    expect(credits.map((line) => line.amount.minorUnits)).toEqual([5_000, 500_000]);

    const [, update] = deps.repository.loans.updateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set).toMatchObject({ status: 'settled', outstandingPrincipalMinorUnits: 0 });
  });
});

describe('LoanRepaymentService.payoffQuote', () => {
  it('quotes the outstanding position with a seven-day validity window', async () => {
    const deps = setup();

    const quote = await deps.service.payoffQuote('loan-1', 'cust-1');

    expect(quote.loanId).toBe('loan-1');
    expect(quote.asOf).toBe(TODAY);
    expect(quote.outstandingPrincipal.minorUnits).toBe(500_000);
    expect(quote.validUntil).toBe(new Date(NOW.getTime() + 7 * 86_400_000).toISOString());
  });

  it('refuses a quote on a non-live loan', async () => {
    const deps = setup({ loan: loanDoc({ status: 'approved' }) });

    await expect(deps.service.payoffQuote('loan-1', 'cust-1')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
