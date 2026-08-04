import { fromMinorUnits, getScale } from '@icb/money';
import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InsufficientFundsError } from '../../../common/errors/index.js';
import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { PostingCommand } from '../../ledger/domain/posting.types.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import type { LoanDoc } from '../infrastructure/loan.schemas.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoanRepaymentService, type RepaymentRequest } from '../loan-repayment.service.js';
import { NOW, SESSION, TODAY, instalmentSub, loanDoc } from './fixtures.js';

export function repaymentRequest(
  amountMinorUnits: number,
  kind: RepaymentRequest['kind'] = 'scheduled',
  currency: RepaymentRequest['amount']['currency'] = 'USD',
): RepaymentRequest {
  return {
    fromAccountId: 'acct-1',
    amount: { minorUnits: amountMinorUnits, currency, scale: getScale(currency) },
    kind,
  };
}

export function repaymentSetup(loan: LoanDoc = loanDoc(), availableMinorUnits = 1_000_000) {
  const loans = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const repository = {
    loans,
    applications: {},
    requireLoan: vi.fn().mockResolvedValue(loan),
  };
  const accounts = {
    loadSpendable: vi
      .fn()
      .mockResolvedValue({ _id: 'acct-1', number: '10020030', currency: 'USD' }),
    balancesFor: vi.fn().mockResolvedValue({
      ledger: fromMinorUnits(availableMinorUnits, 'USD'),
      holds: fromMinorUnits(0, 'USD'),
      available: fromMinorUnits(availableMinorUnits, 'USD'),
    }),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const transactionManager = {
    withTransaction: vi.fn(<T,>(work: (session: ClientSession) => Promise<T>): Promise<T> =>
      work(SESSION),
    ),
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
  return { service, repository, loans, accounts, ledger, transactionManager };
}

function patchOf(loans: { updateOne: ReturnType<typeof vi.fn> }): Partial<LoanDoc> {
  const [filter, update, options] = loans.updateOne.mock.calls[0] ?? [];
  expect(filter).toEqual({ _id: 'loan-1' });
  expect(options).toEqual({ session: SESSION });
  return (update as { $set: Partial<LoanDoc> }).$set;
}

describe('LoanRepaymentService.repay', () => {
  let context: ReturnType<typeof repaymentSetup>;

  beforeEach(() => {
    context = repaymentSetup();
  });

  it('applies the waterfall interest then principal and posts one balanced transaction', async () => {
    const detail = await context.service.repay('loan-1', 'cust-1', repaymentRequest(23_500));

    expect(context.repository.requireLoan).toHaveBeenCalledWith('loan-1', 'cust-1');

    const command = context.ledger.postWithin.mock.calls[0]?.[0] as PostingCommand;
    expect(command.type).toBe('loan_repayment');
    expect(command.description).toBe('Repayment of loan LN-TESTREF');
    expect(command.actor).toEqual({ kind: 'customer', id: 'cust-1', label: '10020030' });
    expect(command.sourceType).toBe('loan');
    expect(command.sourceId).toBe('loan-1');
    expect(command.reference).toMatch(/^LNR-/);
    expect(command.lines).toEqual([
      {
        accountRef: 'acct:acct-1',
        direction: 'debit',
        amount: { minorUnits: 23_500, currency: 'USD' },
        narrative: 'Loan repayment',
      },
      {
        accountRef: 'gl:4100',
        direction: 'credit',
        amount: { minorUnits: 5_000, currency: 'USD' },
        narrative: 'Loan interest',
      },
      {
        accountRef: 'gl:1100',
        direction: 'credit',
        amount: { minorUnits: 18_500, currency: 'USD' },
        narrative: 'Loan principal',
      },
    ]);

    const patch = patchOf(context.loans);
    expect(patch.outstandingPrincipalMinorUnits).toBe(481_500);
    expect(patch.accruedInterestMinorUnits).toBe(0);
    expect(patch.lastAccrualOn).toBe(TODAY);
    expect(patch.status).toBe('active');
    expect(patch.settledAt).toBeNull();
    expect(patch.updatedAt).toEqual(NOW);
    expect(patch.schedule?.[0]?.status).toBe('paid');
    expect(patch.schedule?.[0]?.paidAt).toEqual(NOW);

    expect(detail.status).toBe('active');
    expect(detail.arrears).toBeNull();
    expect(detail.outstandingPrincipal.minorUnits).toBe(481_500);
    expect(detail.schedule[0]?.status).toBe('paid');
    expect(detail.repaymentAccountId).toBe('acct-1');
  });

  it('pays outstanding charges first, booking them to fee income', async () => {
    const { service, ledger, loans } = repaymentSetup(
      loanDoc({ feesOutstandingMinorUnits: 2_000 }),
    );

    await service.repay('loan-1', 'cust-1', repaymentRequest(23_500));

    const command = ledger.postWithin.mock.calls[0]?.[0] as PostingCommand;
    expect(command.lines[1]).toEqual({
      accountRef: 'gl:4000',
      direction: 'credit',
      amount: { minorUnits: 2_000, currency: 'USD' },
      narrative: 'Loan charges',
    });
    expect(command.lines).toHaveLength(4);
    expect(patchOf(loans).feesOutstandingMinorUnits).toBe(0);
  });

  it('omits zero legs rather than posting empty credits', async () => {
    const detail = await context.service.repay('loan-1', 'cust-1', repaymentRequest(5_000));

    const command = context.ledger.postWithin.mock.calls[0]?.[0] as PostingCommand;
    expect(command.lines).toHaveLength(2);
    expect(command.lines[1]?.accountRef).toBe('gl:4100');

    const patch = patchOf(context.loans);
    expect(patch.accruedInterestMinorUnits).toBe(0);
    expect(patch.outstandingPrincipalMinorUnits).toBe(500_000);
    expect(patch.schedule?.[0]?.status).toBe('partially_paid');
    expect(detail.schedule[0]?.paidAmount?.minorUnits).toBe(5_000);
  });

  it('ages an overdue instalment into arrears when a payment does not clear it', async () => {
    const { service, loans } = repaymentSetup(
      loanDoc({ schedule: [instalmentSub({ dueOn: '2026-07-04' })] }),
    );

    const detail = await service.repay('loan-1', 'cust-1', repaymentRequest(5_000));

    expect(patchOf(loans).status).toBe('in_arrears');
    expect(detail.status).toBe('in_arrears');
    expect(detail.arrears).not.toBeNull();
    expect(detail.arrears?.bucket).toBe('30_59');
    expect(detail.arrears?.missedInstalments).toBe(1);
    expect(detail.arrears?.amount.minorUnits).toBe(18_500);
  });

  it('refuses a repayment the source account cannot fund', async () => {
    const { service, ledger, loans } = repaymentSetup(loanDoc(), 10_000);

    await expect(service.repay('loan-1', 'cust-1', repaymentRequest(23_500))).rejects.toThrow(
      InsufficientFundsError,
    );
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(loans.updateOne).not.toHaveBeenCalled();
  });
});
