import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import type { FeeChargeDoc } from '../../../simulation/eod/infrastructure/eod.schemas.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { GL_FEE_INCOME } from '../../ledger/domain/chart-of-accounts.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import { FEE_CODES } from '../accruals.constants.js';
import { FeeChargeService, type FeeChargeInput } from '../fee-charge.service.js';

const AS_OF = new Date('2026-08-15T23:00:00.000Z');

function input(overrides: Partial<FeeChargeInput> = {}): FeeChargeInput {
  return {
    account: { _id: 'acct-1', customerId: 'cust-1' } as AccountDoc,
    code: FEE_CODES.maintenance,
    period: '2026-08',
    fee: fromMinorUnits(500, 'USD'),
    waivedReason: null,
    description: 'Account maintenance fee — 2026-08',
    incomeGlCode: GL_FEE_INCOME,
    valueDate: '2026-08-15',
    asOf: AS_OF,
    ...overrides,
  };
}

function setup(claimError?: unknown) {
  const chargesModel = {
    create: claimError ? vi.fn().mockRejectedValue(claimError) : vi.fn().mockResolvedValue([{}]),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => Promise<unknown>) => work({ id: 's' })),
  };
  const service = new FeeChargeService(
    chargesModel as unknown as Model<FeeChargeDoc>,
    ledger as unknown as LedgerService,
    transactionManager as unknown as TransactionManager,
  );
  return { service, chargesModel, ledger };
}

describe('FeeChargeService', () => {
  it('claims the period and posts customer-debit to fee-income credit', async () => {
    const { service, chargesModel, ledger } = setup();

    const outcome = await service.charge(input());

    expect(outcome).toBe('posted');
    expect(chargesModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          accountId: 'acct-1',
          period: '2026-08',
          code: 'ACCOUNT_MAINTENANCE',
          minorUnits: 500,
          currency: 'USD',
          waivedReason: null,
        }),
      ],
      expect.anything(),
    );
    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fee',
        lines: [
          expect.objectContaining({ accountRef: 'acct:acct-1', direction: 'debit' }),
          expect.objectContaining({ accountRef: `gl:${GL_FEE_INCOME}`, direction: 'credit' }),
        ],
      }),
      expect.anything(),
    );
    expect(chargesModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      { $set: { postedTransactionId: 'txn-1' } },
      expect.anything(),
    );
  });

  it('records a waived fee without posting — the waiver stays visible', async () => {
    const { service, chargesModel, ledger } = setup();

    const outcome = await service.charge(input({ waivedReason: 'Fee waived for premium tier' }));

    expect(outcome).toBe('waived');
    expect(chargesModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ waivedReason: 'Fee waived for premium tier' })],
      expect.anything(),
    );
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(chargesModel.updateOne).not.toHaveBeenCalled();
  });

  it('charges nothing when the period is already claimed — idempotent on replay', async () => {
    const { service, ledger } = setup(Object.assign(new Error('dup'), { code: 11000 }));

    const outcome = await service.charge(input());

    expect(outcome).toBe('duplicate');
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });

  it('rethrows claim failures that are not duplicate keys', async () => {
    const { service } = setup(new Error('connection lost'));

    await expect(service.charge(input())).rejects.toThrow('connection lost');
  });
});
