import type { AccountBalances, AccountDetail } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountsController } from '../accounts.controller.js';
import type { AccountsService } from '../accounts.service.js';
import type { AccountClosureService } from '../application/account-closure.service.js';
import type { AccountHoldsService } from '../application/account-holds.service.js';
import type { AccountOpeningService } from '../application/account-opening.service.js';
import type { AccountProfileService } from '../application/account-profile.service.js';
import type { BalanceHistoryService } from '../application/balance-history.service.js';

const CUSTOMER_ID = 'cust-1';
const ACCOUNT_ID = 'acct-1';

const BALANCES: AccountBalances = {
  available: { minorUnits: 9_000, currency: 'USD', scale: 2 },
  current: { minorUnits: 10_000, currency: 'USD', scale: 2 },
  holds: { minorUnits: 1_000, currency: 'USD', scale: 2 },
} as unknown as AccountBalances;

const DETAIL = { id: ACCOUNT_ID, customerId: CUSTOMER_ID, balances: BALANCES } as unknown as AccountDetail;

describe('AccountsController', () => {
  let accounts: { listForCustomer: ReturnType<typeof vi.fn>; getForCustomer: ReturnType<typeof vi.fn> };
  let opening: { openForCustomer: ReturnType<typeof vi.fn> };
  let closure: { close: ReturnType<typeof vi.fn> };
  let history: { historyFor: ReturnType<typeof vi.fn> };
  let profile: { update: ReturnType<typeof vi.fn> };
  let holds: { holdsFor: ReturnType<typeof vi.fn> };
  let controller: AccountsController;

  beforeEach(() => {
    accounts = {
      listForCustomer: vi.fn().mockResolvedValue([]),
      getForCustomer: vi.fn().mockResolvedValue(DETAIL),
    };
    opening = { openForCustomer: vi.fn().mockResolvedValue(DETAIL) };
    closure = { close: vi.fn().mockResolvedValue(DETAIL) };
    history = { historyFor: vi.fn().mockResolvedValue({ points: [] }) };
    profile = { update: vi.fn().mockResolvedValue(undefined) };
    holds = { holdsFor: vi.fn().mockResolvedValue([{ id: 'hold-1' }]) };

    controller = new AccountsController(
      accounts as unknown as AccountsService,
      opening as unknown as AccountOpeningService,
      closure as unknown as AccountClosureService,
      history as unknown as BalanceHistoryService,
      profile as unknown as AccountProfileService,
      holds as unknown as AccountHoldsService,
    );
  });

  it('lists accounts for the token customer inside an items envelope', async () => {
    accounts.listForCustomer.mockResolvedValue([{ id: ACCOUNT_ID }]);

    const result = await controller.list(CUSTOMER_ID);

    expect(accounts.listForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual({ items: [{ id: ACCOUNT_ID }] });
  });

  it('opens an account through the opening service', async () => {
    const body = { product: 'current', currency: 'USD' };

    const result = await controller.open(CUSTOMER_ID, body as never);

    expect(opening.openForCustomer).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('looks up the detail scoped by the token customer', async () => {
    const result = await controller.detail(CUSTOMER_ID, ACCOUNT_ID);

    expect(accounts.getForCustomer).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(result).toBe(DETAIL);
  });

  it('updates the profile then re-reads the detail', async () => {
    const body = { nickname: 'Everyday' };

    const result = await controller.update(CUSTOMER_ID, ACCOUNT_ID, body);

    expect(profile.update).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID, body);
    expect(accounts.getForCustomer).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(result).toBe(DETAIL);
  });

  it('closes through the closure service', async () => {
    const body = { reason: 'No longer needed' };

    const result = await controller.close(CUSTOMER_ID, ACCOUNT_ID, body);

    expect(closure.close).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('returns the balances of the owned account', async () => {
    const result = await controller.balances(CUSTOMER_ID, ACCOUNT_ID);

    expect(accounts.getForCustomer).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(result).toBe(BALANCES);
  });

  it('passes the resolved account and query to the history service', async () => {
    const query = { from: '2026-01-01', to: '2026-01-31' };
    history.historyFor.mockResolvedValue({ points: [{ date: '2026-01-01' }] });

    const result = await controller.balanceHistory(CUSTOMER_ID, ACCOUNT_ID, query as never);

    expect(accounts.getForCustomer).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(history.historyFor).toHaveBeenCalledWith(DETAIL, query);
    expect(result).toEqual({ points: [{ date: '2026-01-01' }] });
  });

  it('verifies ownership before listing holds, with no envelope', async () => {
    const result = await controller.holds(CUSTOMER_ID, ACCOUNT_ID);

    expect(accounts.getForCustomer).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(holds.holdsFor).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(result).toEqual([{ id: 'hold-1' }]);
  });

  it('propagates a NotFoundError from the ownership lookup', async () => {
    accounts.getForCustomer.mockRejectedValue(new Error('not found'));

    await expect(controller.holds(CUSTOMER_ID, ACCOUNT_ID)).rejects.toThrow('not found');
    expect(holds.holdsFor).not.toHaveBeenCalled();
  });
});
