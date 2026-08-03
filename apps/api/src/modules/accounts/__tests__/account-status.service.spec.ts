import type { AccountDetail } from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { AccountStatusService } from '../application/account-status.service.js';
import { AccountNotEmptyError, AccountTransitionError } from '../domain/account.errors.js';

const CURRENCY = 'USD';
const DETAIL = { id: 'acct_1' } as unknown as AccountDetail;

function balances(ledgerMinorUnits: number, holdMinorUnits = 0) {
  return {
    ledger: fromMinorUnits(ledgerMinorUnits, CURRENCY),
    holds: fromMinorUnits(holdMinorUnits, CURRENCY),
    available: fromMinorUnits(ledgerMinorUnits - holdMinorUnits, CURRENCY),
  };
}

function harness(status: string | null, ledgerMinorUnits = 0, holdMinorUnits = 0) {
  const account =
    status === null
      ? null
      : { _id: 'acct_1', customerId: 'cust_1', currency: CURRENCY, status };
  const model = {
    findOne: vi.fn(() => ({ lean: () => Promise.resolve(account) })),
    updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1 })),
  };
  const core = {
    balancesFor: vi.fn(() => Promise.resolve(balances(ledgerMinorUnits, holdMinorUnits))),
    getForCustomer: vi.fn(() => Promise.resolve(DETAIL)),
  };
  const clock = { now: () => new Date('2026-08-01T12:00:00.000Z') };
  const service = new AccountStatusService(model as never, core as never, clock as never);
  return { model, core, service };
}

describe('AccountStatusService.transition — freeze guards', () => {
  it('freezes an active account', async () => {
    const { model, service } = harness('active');

    await service.transition('acct_1', 'frozen', 'Suspected fraud');

    expect(model.updateOne).toHaveBeenCalledWith({ _id: 'acct_1' }, { $set: { status: 'frozen' } });
  });

  it('unfreezes a frozen account back to active', async () => {
    const { model, service } = harness('frozen');

    await service.transition('acct_1', 'active', 'Customer verified');

    expect(model.updateOne).toHaveBeenCalledWith({ _id: 'acct_1' }, { $set: { status: 'active' } });
  });

  it('refuses to freeze an account that is not active', async () => {
    const { model, service } = harness('pending');

    await expect(service.transition('acct_1', 'frozen', 'Jumping the gun')).rejects.toThrow(
      AccountTransitionError,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to resurrect a closed account — closed is terminal', async () => {
    const { model, service } = harness('closed');

    await expect(service.transition('acct_1', 'active', 'Mistake')).rejects.toThrow(
      AccountTransitionError,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('treats re-applying the current status as a no-op', async () => {
    const { model, service } = harness('frozen');

    const result = await service.transition('acct_1', 'frozen', 'Duplicate call');

    expect(result).toBe(DETAIL);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('AccountStatusService.transition — administrative close', () => {
  it('closes an empty account, stamping the closure', async () => {
    const { model, service } = harness('active');

    await service.transition('acct_1', 'closed', 'Customer request');

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'acct_1' },
      {
        $set: {
          status: 'closed',
          closedAt: new Date('2026-08-01T12:00:00.000Z'),
          closureReason: 'Customer request',
        },
      },
    );
  });

  it('enforces the zero-balance rule for staff too', async () => {
    const { model, service } = harness('active', 9_999);

    await expect(service.transition('acct_1', 'closed', 'Fat finger')).rejects.toThrow(
      AccountNotEmptyError,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('blocks closure while holds are outstanding', async () => {
    const { service } = harness('active', 0, 500);

    await expect(service.transition('acct_1', 'closed', 'Fat finger')).rejects.toThrow(
      AccountNotEmptyError,
    );
  });
});

describe('AccountStatusService.setOverdraft', () => {
  it('writes the limit to the account document only', async () => {
    const { model, core, service } = harness('active');

    const result = await service.setOverdraft('acct_1', 100_000);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'acct_1' },
      { $set: { overdraftMinorUnits: 100_000 } },
    );
    // The ledger's balance cache is never touched from here (N4).
    expect(core.balancesFor).not.toHaveBeenCalled();
    expect(result).toBe(DETAIL);
  });

  it('refuses an unknown account', async () => {
    const { service } = harness(null);

    await expect(service.setOverdraft('acct_9', 100)).rejects.toThrow(NotFoundError);
  });
});
