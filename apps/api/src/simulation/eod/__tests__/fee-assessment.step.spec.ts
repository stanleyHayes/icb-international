import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import type { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import type { AccountBalanceDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import type { LedgerService } from '../../../modules/ledger/ledger.service.js';
import type { FeeChargeDoc } from '../infrastructure/eod.schemas.js';
import { FeeAssessmentStep } from '../steps/fee-assessment.step.js';
import {
  CONTEXT,
  NOW,
  SESSION,
  accountDoc,
  duplicateKeyError,
  inlineTransactions,
  leanQuery,
  sortedLeanQuery,
} from './fixtures.js';

interface BalanceRow {
  ledgerMinorUnits: number;
  holdMinorUnits: number;
  overdraftMinorUnits: number;
}

function setup(accounts: AccountDoc[], balanceRow: BalanceRow | null, claimError?: unknown) {
  const accountsModel = { find: vi.fn().mockReturnValue(sortedLeanQuery(accounts)) };
  const balancesModel = { findOne: vi.fn().mockReturnValue(leanQuery(balanceRow)) };
  const chargesModel = {
    create: claimError ? vi.fn().mockRejectedValue(claimError) : vi.fn().mockResolvedValue([{}]),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-fee-1' }) };
  const transactions = inlineTransactions();

  const step = new FeeAssessmentStep(
    accountsModel as unknown as Model<AccountDoc>,
    balancesModel as unknown as Model<AccountBalanceDoc>,
    chargesModel as unknown as Model<FeeChargeDoc>,
    ledger as unknown as LedgerService,
    transactions as unknown as TransactionManager,
  );
  return { step, accountsModel, chargesModel, ledger };
}

const RICH: BalanceRow = { ledgerMinorUnits: 1_000, holdMinorUnits: 0, overdraftMinorUnits: 0 };

describe('FeeAssessmentStep', () => {
  it('charges the monthly fee on the account’s statement day', async () => {
    const { step, accountsModel, chargesModel } = setup([accountDoc()], RICH);

    const totals = await step.run(CONTEXT);

    expect(accountsModel.find).toHaveBeenCalledWith({
      status: 'active',
      statementDay: 4,
      monthlyFeeMinorUnits: { $gt: 0 },
    });
    expect(totals.toMoney('USD').minorUnits).toBe(500);
    expect(chargesModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          accountId: 'acct-1',
          period: '2026-08',
          code: 'ACCOUNT_MAINTENANCE',
          minorUnits: 500,
          currency: 'USD',
          postedTransactionId: null,
          waivedReason: null,
          createdAt: NOW,
        }),
      ],
      { session: SESSION, ordered: true },
    );
  });

  it('posts the fee against fee income and stamps the charge with the transaction id', async () => {
    const { step, ledger, chargesModel } = setup([accountDoc()], RICH);

    await step.run(CONTEXT);

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fee',
        description: 'Account maintenance fee — 2026-08',
        sourceType: 'fee_charge',
        lines: [
          expect.objectContaining({ accountRef: 'acct:acct-1', direction: 'debit' }),
          expect.objectContaining({ accountRef: 'gl:4000', direction: 'credit' }),
        ],
      }),
      SESSION,
    );
    expect(chargesModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(String) },
      { $set: { postedTransactionId: 'txn-fee-1' } },
      { session: SESSION },
    );
  });

  it('records an unaffordable fee as waived instead of forcing an overdraft', async () => {
    const { step, chargesModel, ledger } = setup([accountDoc()], {
      ledgerMinorUnits: 100,
      holdMinorUnits: 0,
      overdraftMinorUnits: 0,
    });

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(chargesModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ waivedReason: 'Insufficient available balance' })],
      expect.anything(),
    );
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(chargesModel.updateOne).not.toHaveBeenCalled();
  });

  it('counts an arranged overdraft towards affordability', async () => {
    const { step, ledger } = setup([accountDoc()], {
      ledgerMinorUnits: 100,
      holdMinorUnits: 0,
      overdraftMinorUnits: 1_000,
    });

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(500);
    expect(ledger.postWithin).toHaveBeenCalled();
  });

  it('treats held funds as unavailable when judging affordability', async () => {
    const { step, chargesModel } = setup([accountDoc()], {
      ledgerMinorUnits: 1_000,
      holdMinorUnits: 600,
      overdraftMinorUnits: 0,
    });

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(chargesModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ waivedReason: 'Insufficient available balance' })],
      expect.anything(),
    );
  });

  it('skips accounts whose configured fee is zero', async () => {
    const { step, chargesModel } = setup([accountDoc({ monthlyFeeMinorUnits: 0 })], RICH);

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(chargesModel.create).not.toHaveBeenCalled();
  });

  it('charges nothing when the month is already claimed — idempotent on replay', async () => {
    const { step, ledger } = setup([accountDoc()], RICH, duplicateKeyError());

    const totals = await step.run(CONTEXT);

    expect(totals.toMoney('USD').minorUnits).toBe(0);
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });

  it('rethrows claim failures that are not duplicate keys', async () => {
    const { step } = setup([accountDoc()], RICH, new Error('connection lost'));

    await expect(step.run(CONTEXT)).rejects.toThrow('connection lost');
  });

  it('does nothing when no account is due on the day', async () => {
    const { step, chargesModel } = setup([], RICH);

    const totals = await step.run(CONTEXT);

    expect(totals.breakdown()).toEqual([]);
    expect(chargesModel.create).not.toHaveBeenCalled();
  });
});
