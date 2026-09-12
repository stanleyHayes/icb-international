import type { AccountDetail, BalanceHistory, Hold } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountsService } from '../accounts.service.js';
import { AdminAccountsController } from '../admin-accounts.controller.js';
import type { AccountHoldsService } from '../application/account-holds.service.js';
import type { AccountTermsService } from '../application/account-terms.service.js';
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
  let terms: {
    changeProduct: ReturnType<typeof vi.fn>;
    setInterestOverride: ReturnType<typeof vi.fn>;
    releaseHold: ReturnType<typeof vi.fn>;
  };
  let controller: AdminAccountsController;

  beforeEach(() => {
    status = {
      transition: vi.fn().mockResolvedValue(DETAIL),
      setOverdraft: vi.fn().mockResolvedValue(DETAIL),
    };
    accounts = { getForStaff: vi.fn().mockResolvedValue(DETAIL) };
    history = { historyFor: vi.fn().mockResolvedValue(HISTORY) };
    holds = { holdsFor: vi.fn().mockResolvedValue(HOLDS) };
    terms = {
      changeProduct: vi.fn().mockResolvedValue(DETAIL),
      setInterestOverride: vi.fn().mockResolvedValue(DETAIL),
      releaseHold: vi.fn().mockResolvedValue(undefined),
    };
    controller = new AdminAccountsController(
      accounts as unknown as AccountsService,
      status as unknown as AccountStatusService,
      terms as unknown as AccountTermsService,
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

  it('moves the account to another product', async () => {
    // The console has always had this button; until now it posted to a route that did not exist.
    const body = { productCode: 'ICB-SAVINGS', reason: 'Customer requested the savings tier' };

    const result = await controller.changeProduct(ACCOUNT_ID, body);

    expect(terms.changeProduct).toHaveBeenCalledWith(ACCOUNT_ID, 'ICB-SAVINGS');
    expect(result).toBe(DETAIL);
  });

  it('sets an interest rate, and passes null through as "restore the product rate"', async () => {
    await controller.setInterestOverride(ACCOUNT_ID, { rate: 3.5, reason: 'Retention offer' });
    expect(terms.setInterestOverride).toHaveBeenCalledWith(ACCOUNT_ID, 3.5);

    await controller.setInterestOverride(ACCOUNT_ID, { rate: null, reason: 'Offer ended' });
    expect(terms.setInterestOverride).toHaveBeenLastCalledWith(ACCOUNT_ID, null);
  });

  it('releases a hold against the account in the path', async () => {
    const body = { reason: 'Merchant abandoned the sale' };

    await controller.releaseHold(ACCOUNT_ID, 'hold-1', body);

    // Both ids travel together so the service can refuse a hold on someone else's account.
    expect(terms.releaseHold).toHaveBeenCalledWith(ACCOUNT_ID, 'hold-1', 'Merchant abandoned the sale');
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
