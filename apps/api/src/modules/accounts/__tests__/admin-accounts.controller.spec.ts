import type { AccountDetail, BalanceHistory, Hold } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountsService } from '../accounts.service.js';
import { AdminAccountsController } from '../admin-accounts.controller.js';
import type { AccountHoldsService } from '../application/account-holds.service.js';
import type { AccountStatusService } from '../application/account-status.service.js';
import type { BalanceHistoryService } from '../application/balance-history.service.js';

const ACCOUNT_ID = 'acct-1';
const DETAIL = { id: ACCOUNT_ID } as unknown as AccountDetail;
const HISTORY = { points: [] } as unknown as BalanceHistory;
const HOLDS = [{ id: 'hold-1' }] as unknown as Hold[];

describe('AdminAccountsController', () => {
  let status: { transition: ReturnType<typeof vi.fn>; setOverdraft: ReturnType<typeof vi.fn> };
  let accounts: { getForStaff: ReturnType<typeof vi.fn> };
  let history: { historyFor: ReturnType<typeof vi.fn> };
  let holds: { holdsFor: ReturnType<typeof vi.fn> };
  let controller: AdminAccountsController;

  beforeEach(() => {
    status = {
      transition: vi.fn().mockResolvedValue(DETAIL),
      setOverdraft: vi.fn().mockResolvedValue(DETAIL),
    };
    accounts = { getForStaff: vi.fn().mockResolvedValue(DETAIL) };
    history = { historyFor: vi.fn().mockResolvedValue(HISTORY) };
    holds = { holdsFor: vi.fn().mockResolvedValue(HOLDS) };
    controller = new AdminAccountsController(
      accounts as unknown as AccountsService,
      status as unknown as AccountStatusService,
      history as unknown as BalanceHistoryService,
      holds as unknown as AccountHoldsService,
    );
  });

  it('reads an account staff do not own', async () => {
    // The console's account page could not load at all before these reads existed, which put
    // the manual-posting form on it out of reach.
    const result = await controller.detail(ACCOUNT_ID);

    expect(accounts.getForStaff).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(result).toBe(DETAIL);
  });

  it('returns balance history for the account it just resolved', async () => {
    const query = { from: '2026-01-01', to: '2026-02-01' };

    const result = await controller.balanceHistory(ACCOUNT_ID, query as never);

    expect(accounts.getForStaff).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(history.historyFor).toHaveBeenCalledWith(DETAIL, query);
    expect(result).toBe(HISTORY);
  });

  it('returns holds as a bare array, matching the customer route', async () => {
    const result = await controller.accountHolds(ACCOUNT_ID);

    // Resolved first so an unknown account 404s rather than reading as "no holds".
    expect(accounts.getForStaff).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(holds.holdsFor).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(result).toBe(HOLDS);
  });

  it('transitions the account status with the staff-supplied reason', async () => {
    const body = { status: 'frozen', reason: 'Fraud review' };

    const result = await controller.setStatus(ACCOUNT_ID, body as never);

    expect(status.transition).toHaveBeenCalledWith(ACCOUNT_ID, 'frozen', 'Fraud review');
    expect(result).toBe(DETAIL);
  });

  it('sets the overdraft limit in minor units', async () => {
    const body = { limit: { minorUnits: 50_000, currency: 'USD', scale: 2 } };

    const result = await controller.setOverdraft(ACCOUNT_ID, body as never);

    expect(status.setOverdraft).toHaveBeenCalledWith(ACCOUNT_ID, 50_000);
    expect(result).toBe(DETAIL);
  });
});
