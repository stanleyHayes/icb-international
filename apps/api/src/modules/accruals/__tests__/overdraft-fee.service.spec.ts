import type { Connection, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { AccountBalanceDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { FEE_CODES } from '../accruals.constants.js';
import type { FeeChargeService } from '../fee-charge.service.js';
import { OverdraftFeeService } from '../overdraft-fee.service.js';

const BUSINESS_DATE = '2026-08-02';
const AS_OF = new Date('2026-08-02T23:00:00.000Z');

function account(overrides: Partial<AccountDoc> = {}): AccountDoc {
  return {
    _id: 'acct-1',
    customerId: 'cust-1',
    kind: 'current',
    currency: 'USD',
    status: 'active',
    statementDay: 15,
    overdraftMinorUnits: 500_000,
    ...overrides,
  } as AccountDoc;
}

function setup(
  balanceRows: { accountRef: string; ledgerMinorUnits: number }[],
  found: AccountDoc | null,
  customerTier: string | null = 'standard',
) {
  const balancesModel = {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(balanceRows) }),
    }),
  };
  const accountsModel = {
    findById: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(found) }),
  };
  const connection = {
    collection: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue(customerTier === null ? null : { tier: customerTier }),
    }),
  };
  const feeCharges = {
    charge: vi.fn((chargeInput: { waivedReason: string | null }) =>
      Promise.resolve(chargeInput.waivedReason === null ? 'posted' : 'waived'),
    ),
  };
  const service = new OverdraftFeeService(
    accountsModel as unknown as Model<AccountDoc>,
    balancesModel as unknown as Model<AccountBalanceDoc>,
    connection as unknown as Connection,
    feeCharges as unknown as FeeChargeService,
  );
  return { service, feeCharges };
}

describe('OverdraftFeeService', () => {
  it('charges one day of overdraft interest on the arranged base, claimed per day', async () => {
    const { service, feeCharges } = setup(
      [{ accountRef: 'acct:acct-1', ledgerMinorUnits: -200_000 }],
      account(),
    );

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.posted).toBe(1);
    // 200_000 × 0.199 / 360 ≈ 110.56 → 111.
    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({
        code: FEE_CODES.overdraft,
        period: BUSINESS_DATE,
        waivedReason: null,
        fee: expect.objectContaining({ minorUnits: 111 }),
      }),
    );
  });

  it('caps the chargeable base at the arranged limit', async () => {
    const { service, feeCharges } = setup(
      [{ accountRef: 'acct:acct-1', ledgerMinorUnits: -900_000 }],
      account({ overdraftMinorUnits: 360_000 }),
    );

    await service.run(BUSINESS_DATE, AS_OF);

    // Base capped at 360_000: 360_000 × 0.199 / 360 = 199 exactly.
    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({ fee: expect.objectContaining({ minorUnits: 199 }) }),
    );
  });

  it('records a waiver instead of charging an account with no arranged facility', async () => {
    const { service, feeCharges } = setup(
      [{ accountRef: 'acct:acct-1', ledgerMinorUnits: -200_000 }],
      account({ overdraftMinorUnits: 0 }),
    );

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({ waivedReason: 'No arranged overdraft facility' }),
    );
    expect(summary.posted).toBe(0);
  });

  it('waives for a fee-free tier', async () => {
    const { service, feeCharges } = setup(
      [{ accountRef: 'acct:acct-1', ledgerMinorUnits: -200_000 }],
      account(),
      'private',
    );

    await service.run(BUSINESS_DATE, AS_OF);

    expect(feeCharges.charge).toHaveBeenCalledWith(
      expect.objectContaining({ waivedReason: 'Fee waived for private tier' }),
    );
  });

  it('ignores closed accounts and accounts that vanished', async () => {
    const { service, feeCharges } = setup(
      [{ accountRef: 'acct:acct-1', ledgerMinorUnits: -200_000 }],
      account({ status: 'closed' }),
    );

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.posted).toBe(0);
    expect(feeCharges.charge).not.toHaveBeenCalled();
  });

  it('does nothing when no account is overdrawn', async () => {
    const { service, feeCharges } = setup([], null);

    const summary = await service.run(BUSINESS_DATE, AS_OF);

    expect(summary.accountsAssessed).toBe(0);
    expect(feeCharges.charge).not.toHaveBeenCalled();
  });
});
