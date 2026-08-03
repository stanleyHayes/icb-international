import type { Connection, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { GL_FEE_INCOME, GL_FX_INCOME } from '../../ledger/domain/chart-of-accounts.js';
import { FEE_CODES } from '../accruals.constants.js';
import { FeeAssessmentService } from '../fee-assessment.service.js';
import type { FeeChargeService } from '../fee-charge.service.js';
import type { PeriodActivityService } from '../period-activity.service.js';

const STATEMENT_DATE = '2026-08-15';
const AS_OF = new Date('2026-08-15T23:00:00.000Z');

function account(overrides: Partial<AccountDoc> = {}): AccountDoc {
  return {
    _id: 'acct-1',
    customerId: 'cust-1',
    kind: 'current',
    currency: 'USD',
    status: 'active',
    statementDay: 15,
    interestRate: null,
    monthlyFeeMinorUnits: 500,
    minimumBalanceMinorUnits: null,
    overdraftMinorUnits: 0,
    ...overrides,
  } as AccountDoc;
}

interface ActivityStubs {
  debits?: number;
  fxVolume?: number;
  overdue?: number;
  ledger?: number;
  available?: number;
}

function setup(
  accounts: AccountDoc[],
  activity: ActivityStubs = {},
  customerTier: string | null = 'standard',
) {
  const accountsModel = {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(accounts) }),
    }),
  };
  const customers = {
    findOne: vi.fn().mockResolvedValue(customerTier === null ? null : { tier: customerTier }),
  };
  const connection = {
    collection: vi.fn().mockReturnValue(customers),
  };
  const activityService = {
    chargeableDebitCount: vi.fn().mockResolvedValue(activity.debits ?? 0),
    fxVolumeMinorUnits: vi.fn().mockResolvedValue(activity.fxVolume ?? 0),
    overdueInstalmentCount: vi.fn().mockResolvedValue(activity.overdue ?? 0),
    balanceContext: vi.fn().mockResolvedValue({
      ledgerMinorUnits: activity.ledger ?? 100_000,
      availableMinorUnits: activity.available ?? 100_000,
    }),
  };
  const feeCharges = { charge: vi.fn().mockResolvedValue('posted') };
  const service = new FeeAssessmentService(
    accountsModel as unknown as Model<AccountDoc>,
    connection as unknown as Connection,
    activityService as unknown as PeriodActivityService,
    feeCharges as unknown as FeeChargeService,
  );
  return { service, feeCharges, activityService };
}

describe('FeeAssessmentService', () => {
  it('assesses every due fee type on the statement date', async () => {
    const { service, feeCharges } = setup(
      [account()],
      { debits: 13, fxVolume: 1_000_000, overdue: 2 },
    );

    const summary = await service.run(STATEMENT_DATE, AS_OF);

    expect(summary.accountsDue).toBe(1);
    expect(summary.posted).toBe(4);
    const codes = feeCharges.charge.mock.calls.map(
      (call) => (call[0] as { code: string }).code,
    );
    expect(codes).toEqual([
      FEE_CODES.maintenance,
      FEE_CODES.transaction,
      FEE_CODES.fx,
      FEE_CODES.late,
    ]);
    const amounts = feeCharges.charge.mock.calls.map(
      (call) => (call[0] as { fee: { minorUnits: number } }).fee.minorUnits,
    );
    expect(amounts).toEqual([500, 150, 5_000, 5_000]);
  });

  it('credits FX fees to FX income, everything else to fee income', async () => {
    const { service, feeCharges } = setup([account()], { fxVolume: 1_000_000 });

    await service.run(STATEMENT_DATE, AS_OF);

    const gls = feeCharges.charge.mock.calls.map(
      (call) => (call[0] as { incomeGlCode: string }).incomeGlCode,
    );
    expect(gls).toEqual([GL_FEE_INCOME, GL_FX_INCOME]);
  });

  it('skips accounts whose statement date is not today', async () => {
    const { service, feeCharges } = setup([account({ statementDay: 16 })]);

    const summary = await service.run(STATEMENT_DATE, AS_OF);

    expect(summary.accountsDue).toBe(0);
    expect(feeCharges.charge).not.toHaveBeenCalled();
  });

  it('waives fees for a fee-free tier, recording the reason', async () => {
    const { service, feeCharges } = setup([account()], {}, 'premium');

    await service.run(STATEMENT_DATE, AS_OF);

    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({ waivedReason: 'Fee waived for premium tier' }),
    );
  });

  it('waives maintenance when the minimum balance was maintained', async () => {
    const { service, feeCharges } = setup(
      [account({ minimumBalanceMinorUnits: 50_000 })],
      { ledger: 60_000, available: 60_000 },
    );

    await service.run(STATEMENT_DATE, AS_OF);

    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        code: FEE_CODES.maintenance,
        waivedReason: 'Minimum balance maintained',
      }),
    );
  });

  it('waives a fee the account cannot afford rather than forcing an overdraft', async () => {
    const { service, feeCharges } = setup([account()], { ledger: 100, available: 100 });

    await service.run(STATEMENT_DATE, AS_OF);

    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        code: FEE_CODES.maintenance,
        waivedReason: 'Insufficient available balance',
      }),
    );
  });

  it('claims nothing when there is no chargeable activity', async () => {
    const { service, feeCharges } = setup([account({ monthlyFeeMinorUnits: null })]);

    const summary = await service.run(STATEMENT_DATE, AS_OF);

    expect(summary.chargesAttempted).toBe(0);
    expect(feeCharges.charge).not.toHaveBeenCalled();
  });
});
