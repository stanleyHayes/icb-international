import type { AccountDetail } from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountFrozenError, NotFoundError } from '../../../common/errors/index.js';
import { AccountClosureService } from '../application/account-closure.service.js';
import {
  AccountCurrencyMismatchError,
  AccountNotEmptyError,
} from '../domain/account.errors.js';

const CURRENCY = 'USD';
const ACCOUNT = { _id: 'acct_1', customerId: 'cust_1', currency: CURRENCY, status: 'active' };
const TARGET = { _id: 'acct_2', customerId: 'cust_1', currency: CURRENCY, status: 'active' };
const DETAIL = { id: 'acct_1' } as unknown as AccountDetail;

function balances(ledgerMinorUnits: number, holdMinorUnits = 0) {
  return {
    ledger: fromMinorUnits(ledgerMinorUnits, CURRENCY),
    holds: fromMinorUnits(holdMinorUnits, CURRENCY),
    available: fromMinorUnits(ledgerMinorUnits - holdMinorUnits, CURRENCY),
  };
}

function harness(account: Record<string, unknown> | null) {
  const model = {
    findOne: vi.fn(() => ({ lean: () => Promise.resolve(account) })),
    updateOne: vi.fn(() => Promise.resolve({ matchedCount: 1 })),
  };
  const core = {
    balancesFor: vi.fn(() => Promise.resolve(balances(0))),
    loadSpendable: vi.fn(() => Promise.resolve(TARGET)),
    getForCustomer: vi.fn(() => Promise.resolve(DETAIL)),
  };
  const ledger = { post: vi.fn((_command: unknown) => Promise.resolve({})) };
  const clock = { now: () => new Date('2026-08-01T12:00:00.000Z') };
  const service = new AccountClosureService(
    model as never,
    core as never,
    ledger as never,
    clock as never,
  );
  return { model, core, ledger, clock, service };
}

describe('AccountClosureService.close', () => {
  let fixture: ReturnType<typeof harness>;

  beforeEach(() => {
    fixture = harness(ACCOUNT);
  });

  it('closes a zero-balance account and stamps the closure', async () => {
    const result = await fixture.service.close('acct_1', 'cust_1', { reason: 'No longer needed' });

    expect(result).toBe(DETAIL);
    expect(fixture.model.updateOne).toHaveBeenCalledWith(
      { _id: 'acct_1' },
      {
        $set: {
          status: 'closed',
          closedAt: new Date('2026-08-01T12:00:00.000Z'),
          closureReason: 'No longer needed',
        },
      },
    );
    expect(fixture.ledger.post).not.toHaveBeenCalled();
  });

  it('refuses a funded account with no sweep destination — the zero-balance rule', async () => {
    fixture.core.balancesFor.mockResolvedValue(balances(25_000));

    await expect(
      fixture.service.close('acct_1', 'cust_1', { reason: 'No longer needed' }),
    ).rejects.toThrow(AccountNotEmptyError);
    expect(fixture.model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses an overdrawn account even with a sweep destination', async () => {
    fixture.core.balancesFor.mockResolvedValue(balances(-5_000));

    await expect(
      fixture.service.close('acct_1', 'cust_1', {
        reason: 'No longer needed',
        sweepToAccountId: 'acct_2',
      }),
    ).rejects.toThrow(AccountNotEmptyError);
    expect(fixture.ledger.post).not.toHaveBeenCalled();
  });

  it('refuses an account with outstanding holds, even at zero ledger balance', async () => {
    fixture.core.balancesFor.mockResolvedValue(balances(0, 1_200));

    await expect(
      fixture.service.close('acct_1', 'cust_1', {
        reason: 'No longer needed',
        sweepToAccountId: 'acct_2',
      }),
    ).rejects.toThrow(AccountNotEmptyError);
    expect(fixture.model.updateOne).not.toHaveBeenCalled();
  });

  it('sweeps the residual through the ledger, then closes', async () => {
    fixture.core.balancesFor.mockResolvedValue(balances(7_500));

    await fixture.service.close('acct_1', 'cust_1', {
      reason: 'Consolidating',
      sweepToAccountId: 'acct_2',
    });

    const command = fixture.ledger.post.mock.calls[0]?.[0] as {
      lines: { accountRef: string; direction: string; amount: { minorUnits: number } }[];
    };
    expect(command.lines).toEqual([
      { accountRef: 'acct:acct_1', direction: 'debit', amount: expect.objectContaining({ minorUnits: 7_500 }) },
      { accountRef: 'acct:acct_2', direction: 'credit', amount: expect.objectContaining({ minorUnits: 7_500 }) },
    ]);
    expect(fixture.model.updateOne).toHaveBeenCalled();
  });

  it('rejects a sweep destination in another currency', async () => {
    fixture.core.balancesFor.mockResolvedValue(balances(7_500));
    fixture.core.loadSpendable.mockResolvedValue({ ...TARGET, currency: 'GHS' });

    await expect(
      fixture.service.close('acct_1', 'cust_1', {
        reason: 'Consolidating',
        sweepToAccountId: 'acct_2',
      }),
    ).rejects.toThrow(AccountCurrencyMismatchError);
  });

  it('propagates the guard when the sweep target cannot receive money', async () => {
    fixture.core.balancesFor.mockResolvedValue(balances(7_500));
    fixture.core.loadSpendable.mockRejectedValue(new AccountFrozenError('acct_2'));

    await expect(
      fixture.service.close('acct_1', 'cust_1', {
        reason: 'Consolidating',
        sweepToAccountId: 'acct_2',
      }),
    ).rejects.toThrow(AccountFrozenError);
  });

  it('is a no-op on an already-closed account, returning its detail', async () => {
    const closed = harness({ ...ACCOUNT, status: 'closed' });

    const result = await closed.service.close('acct_1', 'cust_1', { reason: 'Again' });

    expect(result).toBe(DETAIL);
    expect(closed.model.updateOne).not.toHaveBeenCalled();
    expect(closed.core.balancesFor).not.toHaveBeenCalled();
  });

  it('scopes the lookup by customer and refuses strangers', async () => {
    const stranger = harness(null);

    await expect(
      stranger.service.close('acct_1', 'cust_2', { reason: 'Not mine' }),
    ).rejects.toThrow(NotFoundError);
    expect(stranger.model.findOne).toHaveBeenCalledWith({ _id: 'acct_1', customerId: 'cust_2' });
  });
});
