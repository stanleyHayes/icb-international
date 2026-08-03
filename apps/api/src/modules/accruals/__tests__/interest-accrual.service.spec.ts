import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { AccountBalanceDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import type { InterestAccrualDoc } from '../../../simulation/eod/infrastructure/eod.schemas.js';
import { InterestAccrualService } from '../interest-accrual.service.js';

const BUSINESS_DATE = '2026-08-02';
const AS_OF = new Date('2026-08-02T23:00:00.000Z');

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

function leanQuery<T>(result: T) {
  return { lean: vi.fn().mockResolvedValue(result) };
}

function setup(
  accounts: AccountDoc[],
  ledgerMinorUnits: number,
  claimError?: unknown,
) {
  const accountsModel = {
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue(leanQuery(accounts)) }),
  };
  const balancesModel = {
    findOne: vi.fn().mockReturnValue(leanQuery({ ledgerMinorUnits })),
  };
  const accrualsModel = {
    create: claimError
      ? vi.fn().mockRejectedValue(claimError)
      : vi.fn().mockResolvedValue([{}]),
  };
  const service = new InterestAccrualService(
    accountsModel as unknown as Model<AccountDoc>,
    balancesModel as unknown as Model<AccountBalanceDoc>,
    accrualsModel as unknown as Model<InterestAccrualDoc>,
  );
  return { service, accrualsModel };
}

describe('InterestAccrualService', () => {
  it('accrues one day of ACT/365 interest on a savings balance', async () => {
    const { service, accrualsModel } = setup([account()], 10_000_000);

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    // Marginal tiers: 500_000 at 2% + 4_500_000 at 2.4% + 5_000_000 at 2.8%
    // = 258_000 a year, blended 2.58%, one day = 258_000 / 365 ≈ 706.85 → 707.
    expect(summary.accountsAccrued).toBe(1);
    expect(summary.minorUnitsByCurrency).toEqual({ USD: 707 });
    expect(accrualsModel.create).toHaveBeenCalledWith([
      expect.objectContaining({
        accountId: 'acct-1',
        accrualDate: BUSINESS_DATE,
        basis: 'ACT/365',
        balanceMinorUnits: 10_000_000,
        rate: 0.0258,
        minorUnits: 707,
        currency: 'USD',
        postedTransactionId: null,
        createdAt: AS_OF,
      }),
    ]);
  });

  it('accrues current accounts ACT/360 at the flat default rate', async () => {
    const { service, accrualsModel } = setup([account({ kind: 'current' })], 10_000_000);

    await service.run(BUSINESS_DATE, AS_OF);

    expect(accrualsModel.create).toHaveBeenCalledWith([
      expect.objectContaining({ basis: 'ACT/360', rate: 0.005, minorUnits: 139 }),
    ]);
  });

  it('accrues fixed deposits without ever posting — capitalisation is at maturity', async () => {
    const { service, accrualsModel } = setup([account({ kind: 'fixed_deposit' })], 10_000_000);

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.accountsAccrued).toBe(1);
    expect(accrualsModel.create).toHaveBeenCalledWith([
      expect.objectContaining({ basis: 'ACT/365', postedTransactionId: null }),
    ]);
  });

  it('honours an account’s own rate over the tier card', async () => {
    const { service, accrualsModel } = setup([account({ interestRate: 0.0365 })], 10_000_000);

    await service.run(BUSINESS_DATE, AS_OF);

    // 10_000_000 × 0.0365 / 365 = 1_000 exactly.
    expect(accrualsModel.create).toHaveBeenCalledWith([
      expect.objectContaining({ rate: 0.0365, minorUnits: 1_000 }),
    ]);
  });

  it('skips accounts with nothing to accrue on', async () => {
    const { service, accrualsModel } = setup([account()], 0);

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.accountsAccrued).toBe(0);
    expect(accrualsModel.create).not.toHaveBeenCalled();
  });

  it('skips sub-unit accruals rather than rounding up to a free unit', async () => {
    const { service, accrualsModel } = setup([account()], 100);

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.accountsAccrued).toBe(0);
    expect(accrualsModel.create).not.toHaveBeenCalled();
  });

  it('records nothing when the day is already claimed — idempotent on replay', async () => {
    const { service } = setup([account()], 10_000_000, Object.assign(new Error('dup'), { code: 11000 }));

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.accountsConsidered).toBe(1);
    expect(summary.accountsAccrued).toBe(0);
    expect(summary.minorUnitsByCurrency).toEqual({});
  });

  it('rethrows claim failures that are not duplicate keys', async () => {
    const { service } = setup([account()], 10_000_000, new Error('connection lost'));

    await expect(service.run(BUSINESS_DATE, AS_OF)).rejects.toThrow('connection lost');
  });
});
