import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import type { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import type { AccountBalanceDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import type { LedgerService } from '../../../modules/ledger/ledger.service.js';
import type { InterestAccrualDoc } from '../infrastructure/eod.schemas.js';
import { InterestAccrualStep } from '../steps/interest-accrual.step.js';
import {
  BUSINESS_DATE,
  CONTEXT,
  NOW,
  SESSION,
  accountDoc,
  duplicateKeyError,
  inlineTransactions,
  leanQuery,
  sortedLeanQuery,
} from './fixtures.js';

function setup(
  accounts: AccountDoc[],
  balanceRow: { ledgerMinorUnits: number } | null,
  claimError?: unknown,
) {
  const accountsModel = { find: vi.fn().mockReturnValue(sortedLeanQuery(accounts)) };
  const balancesModel = { findOne: vi.fn().mockReturnValue(leanQuery(balanceRow)) };
  const accrualsModel = {
    create: claimError ? vi.fn().mockRejectedValue(claimError) : vi.fn().mockResolvedValue([{}]),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-posted-1' }) };
  const transactions = inlineTransactions();

  const step = new InterestAccrualStep(
    accountsModel as unknown as Model<AccountDoc>,
    balancesModel as unknown as Model<AccountBalanceDoc>,
    accrualsModel as unknown as Model<InterestAccrualDoc>,
    ledger as unknown as LedgerService,
    transactions as unknown as TransactionManager,
  );
  return { step, accountsModel, balancesModel, accrualsModel, ledger, transactions };
}

describe('InterestAccrualStep', () => {
  it('accrues one day of ACT/365 interest at the fallback rate', async () => {
    const { step, accountsModel, accrualsModel } = setup([accountDoc()], {
      ledgerMinorUnits: 10_000_000,
    });

    const totals = await step.run(CONTEXT);

    expect(accountsModel.find).toHaveBeenCalledWith({
      kind: { $in: ['savings', 'fixed_deposit'] },
      status: 'active',
    });
    expect(totals.toMoney('USD').minorUnits).toBe(658);
    expect(accrualsModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          accountId: 'acct-1',
          accrualDate: BUSINESS_DATE,
          basis: 'ACT/365',
          balanceMinorUnits: 10_000_000,
          rate: 0.024,
          minorUnits: 658,
          currency: 'USD',
          postedTransactionId: null,
          createdAt: NOW,
        }),
      ],
      { session: SESSION, ordered: true },
    );
  });

  it('honours the account’s own rate over the fallback', async () => {
    const { step, accrualsModel } = setup([accountDoc({ interestRate: 0.0365 })], {
      ledgerMinorUnits: 10_000_000,
    });

    await step.run(CONTEXT);

    expect(accrualsModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ rate: 0.0365, minorUnits: 1_000 })],
      expect.anything(),
    );
  });

  it('posts interest expense against the customer and records the transaction id', async () => {
    const { step, ledger, accrualsModel } = setup([accountDoc()], {
      ledgerMinorUnits: 10_000_000,
    });

    await step.run(CONTEXT);

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'interest',
        description: `Interest for ${BUSINESS_DATE}`,
        valueDate: BUSINESS_DATE,
        sourceType: 'interest_accrual',
        lines: [
          expect.objectContaining({ accountRef: 'gl:5000', direction: 'debit' }),
          expect.objectContaining({ accountRef: 'acct:acct-1', direction: 'credit' }),
        ],
      }),
      SESSION,
    );
    expect(accrualsModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(String) },
      { $set: { postedTransactionId: 'txn-posted-1' } },
      { session: SESSION },
    );
  });

  it('accrues across accounts and sums the totals', async () => {
    const { step } = setup(
      [accountDoc(), accountDoc({ _id: 'acct-2', interestRate: 0.0365 })],
      { ledgerMinorUnits: 10_000_000 },
    );

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(658 + 1_000);
  });

  it('skips accounts with no positive balance', async () => {
    const { step, accrualsModel } = setup([accountDoc()], null);

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(accrualsModel.create).not.toHaveBeenCalled();
  });

  it('skips accruals that round to zero rather than paying a free unit', async () => {
    const { step, accrualsModel } = setup([accountDoc()], { ledgerMinorUnits: 100 });

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(accrualsModel.create).not.toHaveBeenCalled();
  });

  it('claims nothing when the day is already accrued — idempotent on replay', async () => {
    const { step, ledger } = setup(
      [accountDoc()],
      { ledgerMinorUnits: 10_000_000 },
      duplicateKeyError(),
    );

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });

  it('rethrows claim failures that are not duplicate keys', async () => {
    const { step } = setup(
      [accountDoc()],
      { ledgerMinorUnits: 10_000_000 },
      new Error('connection lost'),
    );

    await expect(step.run(CONTEXT)).rejects.toThrow('connection lost');
  });

  it('does nothing when no interest-bearing accounts are active', async () => {
    const { step, balancesModel } = setup([], null);

    const totals = await step.run(CONTEXT);

    expect(totals.breakdown()).toEqual([]);
    expect(balancesModel.findOne).not.toHaveBeenCalled();
  });
});
