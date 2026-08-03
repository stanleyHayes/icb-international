import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import type { InterestAccrualDoc } from '../../../simulation/eod/infrastructure/eod.schemas.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { GL_INTEREST_EXPENSE } from '../../ledger/domain/chart-of-accounts.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import { CapitalisationService } from '../capitalisation.service.js';

const STATEMENT_DATE = '2026-08-15';
const AS_OF = new Date('2026-08-15T23:00:00.000Z');

function account(overrides: Partial<AccountDoc> = {}): AccountDoc {
  return {
    _id: 'acct-1',
    customerId: 'cust-1',
    kind: 'savings',
    currency: 'USD',
    status: 'active',
    statementDay: 15,
    interestRate: null,
    ...overrides,
  } as AccountDoc;
}

function sessionOf() {
  return { id: 'session-1' };
}

function setup(accounts: AccountDoc[], unposted: { _id: string; minorUnits: number }[]) {
  const session = sessionOf();
  const accrualsModel = {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(unposted) }),
      }),
    }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: unposted.length }),
  };
  const accountsModel = {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(accounts) }),
    }),
  };
  const ledger = {
    postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }),
  };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work(session)),
  };
  const service = new CapitalisationService(
    accountsModel as unknown as Model<AccountDoc>,
    accrualsModel as unknown as Model<InterestAccrualDoc>,
    ledger as unknown as LedgerService,
    transactionManager as unknown as TransactionManager,
  );
  return { service, accrualsModel, ledger };
}

describe('CapitalisationService', () => {
  it('posts the sum of unposted accruals on the statement date and marks the rows', async () => {
    const { service, accrualsModel, ledger } = setup(
      [account()],
      [
        { _id: 'acr-1', minorUnits: 548 },
        { _id: 'acr-2', minorUnits: 552 },
      ],
    );

    const summary = await service.run(STATEMENT_DATE, AS_OF);

    expect(summary.accountsCapitalised).toBe(1);
    expect(summary.minorUnitsByCurrency).toEqual({ USD: 1_100 });
    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'interest',
        valueDate: STATEMENT_DATE,
        lines: [
          expect.objectContaining({ accountRef: `gl:${GL_INTEREST_EXPENSE}`, direction: 'debit' }),
          expect.objectContaining({ accountRef: 'acct:acct-1', direction: 'credit' }),
        ],
      }),
      expect.anything(),
    );
    const posting = ledger.postWithin.mock.calls[0]?.[0] as { lines: { amount: { minorUnits: number } }[] };
    expect(posting.lines[0]?.amount.minorUnits).toBe(1_100);
    expect(accrualsModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['acr-1', 'acr-2'] } },
      { $set: { postedTransactionId: 'txn-1' } },
      expect.anything(),
    );
  });

  it('does nothing on a day that is not the capitalisation date', async () => {
    const { service, ledger } = setup([account()], [{ _id: 'acr-1', minorUnits: 548 }]);

    const summary = await service.run('2026-08-16', AS_OF);

    expect(summary.accountsCapitalised).toBe(0);
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });

  it('never capitalises fixed deposits — their interest posts at maturity', async () => {
    const { service, ledger } = setup(
      [account({ kind: 'fixed_deposit' })],
      [{ _id: 'acr-1', minorUnits: 548 }],
    );

    const summary = await service.run(STATEMENT_DATE, AS_OF);

    expect(summary.accountsCapitalised).toBe(0);
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });

  it('posts nothing when every accrual row is already marked — idempotent on replay', async () => {
    const { service, ledger } = setup([account()], []);

    const summary = await service.run(STATEMENT_DATE, AS_OF);

    expect(summary.accountsCapitalised).toBe(0);
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });
});
